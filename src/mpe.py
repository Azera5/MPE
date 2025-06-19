from flask import Flask, render_template, jsonify, request as flask_request  # Renamed to avoid confusion
import os
import subprocess
import requests 

from sqlalchemy import create_engine, func, literal

from sqlalchemy.orm import sessionmaker
from datetime import datetime
import time

import pandas as pd
import numpy as np

from dataset import filter_truthfulqa_data
from db_models import Base, User, Model, Strategy, Question, Query, Answer, Feedback, Metaprompt

from globals import MODELS, META_PROMPTING_MODELS_ONLY, QA_PAIRS, STRATEGIES
from pathlib import Path

from bert_score import score as bert_score


START_APPTAINER = True

# Initialize Flask application
app = Flask(__name__, static_folder='static', template_folder='templates')
app.secret_key = os.urandom(24)  # Secret key for session management
app.config['PERMANENT_SESSION_LIFETIME'] = 30 * 24 * 3600

src_dir = Path(__file__).parent
script_path = src_dir / "start_service.sh"
log_path = src_dir / ".logs"
ollama_sif_path = src_dir / "sifs" / "ollama.sif"

# Database configuration
DATABASE_URL = 'sqlite:///mpe_database.db'  # SQLite database file
engine = create_engine(DATABASE_URL, echo=False)  # echo=True for SQL debugging
Session = sessionmaker(bind=engine)

filtered_data = filter_truthfulqa_data(pd)

# Apptainer configuration
INSTANCE_NAME = 'ollama_instance'

# Ollama configuration
OLLAMA_BASE_URL = 'http://localhost:11434'  # Default Ollama URL
DEFAULT_MODEL = MODELS[0]  # Default model to use if none specified
current_model = 'none'

# Timestamp
RUN_TIMESTAMP=datetime.now().strftime("%Y_%m_%d@%H_%M_%S")

@app.route('/')
def index():
    """Render the main index page"""
    return render_template('index.html', active_tab='prompt')

@app.route('/api/config')
def get_config():
    return jsonify({
        'models': MODELS,
        'meta_models': META_PROMPTING_MODELS_ONLY,
        'qa_pairs': QA_PAIRS,
        'strategies': STRATEGIES
    })

@app.route('/logs')
def show_logs():
    service_output_path = log_path / f"service_output@{RUN_TIMESTAMP}.log"
    service_boot_path = log_path / f"service_boot@{RUN_TIMESTAMP}.log"

    logs = {
        'output': {'path': service_output_path, 'content': '', 'title': 'Service Output'},
        'boot': {'path': service_boot_path, 'content': '', 'title': 'Service Boot'}
    }

    for key in logs:
        try:
            with open(logs[key]['path'], 'r') as f:
                logs[key]['content'] = f.read()
        except FileNotFoundError:
            logs[key]['content'] = f"Log file not found: {logs[key]['path']}"

    return render_template('logs.html', active_tab='logs', logs=logs, timestamp=RUN_TIMESTAMP)

@app.route('/api/users', methods=['GET', 'POST'])
def handle_users():
    """Handle both getting user suggestions and creating new users"""
    if flask_request.method == 'GET':
        return get_user_suggestions()
    elif flask_request.method == 'POST':
        return create_user()

@app.route('/insert_query', methods=['POST'])
def insert_query():
    """Create a new query from question text and user"""
    query_data = flask_request.json
    session = Session()
   
    if 'user' not in query_data or 'question_text' not in query_data:
        return jsonify({'error': 'Missing required fields: user, question_text'}), 400

    try:
        question = session.query(Question).filter_by(question=query_data['question_text']).first()
        if not question:
            return jsonify({
                    'message': 'Operation aborted',
                    'reason': 'Question not found - no entries were processed'
                }), 200 
        
        if not session.query(User).filter_by(user=query_data['user']).first():
            create_user()
        
        new_query = Query(
            user=query_data['user'],
            question_id=question.id,
            best_answer_id=None
        )

        session.add(new_query)
        session.commit()

        return jsonify({
            'message': 'Query created successfully',
            'query_id': new_query.id,
            'question_id': question.id,
            'user': new_query.user
        }), 201

    except Exception as e:
        session.rollback()
        return jsonify({
            'error': 'Failed to create query',
            'details': str(e)
        }), 500
    finally:
        session.close()

@app.route('/insert_answer', methods=['POST'])
def insert_answer():
    """Create new answers in the database"""
    data = flask_request.json
    session = Session()

    if 'answers' not in data:
        return jsonify({'error': 'Missing "answers" list'}), 400

    responses = []

    try:
        for answer_data in data['answers']:
            required_fields = ['question_text', 'answer', 'model', 'user']
            if not all(field in answer_data for field in required_fields):
                return jsonify({'error': f'Missing fields in one of the answers: {answer_data}'}), 400

            # 1. Find the query
            query = session.query(Query).join(Question).filter(
                Question.question == answer_data['question_text'],
                Query.user == answer_data['user']
            ).first()
            if not query:
                return jsonify({
                    'message': 'Operation aborted',
                    'reason': 'Query not found - no entries were processed'
                }), 200 

            # 2. Find the model by name
            model = session.query(Model).filter_by(
                name=answer_data['model']
            ).first()
            if not model:
                continue

            question = session.query(Question).filter_by(id=query.question_id).first()
            bScore = get_bert_score(answer_data['answer'], question.correct_answer)
            # 3. Create new answer
            new_answer = Answer(
                answer=answer_data['answer'],
                model=model.id,
                query_id=query.id,
                position=answer_data.get('position', 0),
                score=answer_data.get('score', 0.0),
                response_time=answer_data.get('response_time', 0.0),
                precision=bScore["Precision"],
                recall=bScore["Recall"],
                f1=bScore["F1"],
            )

            session.add(new_answer)
            session.flush()  # To get ID before commit

            responses.append({
                'answer_id': new_answer.id,
                'query_id': query.id,
                'model_id': model.id
            })

        session.commit()
        return jsonify({
            'message': 'Answers created successfully',
            'results': responses
        }), 201

    except Exception as e:
        session.rollback()
        return jsonify({'error': 'Failed to create answers', 'details': str(e)}), 500
    finally:
        session.close()

@app.route('/insert_metaprompt', methods=['POST'])
def insert_metaprompt():
    """Create multiple metaprompt entries from provided list"""
    data_list = flask_request.json  # Expecting a list of dicts
    session = Session()

    if not isinstance(data_list, list):
        return jsonify({'error': 'Expected a list of metaprompt entries'}), 400

    results = []
    errors = []

    for idx, data in enumerate(data_list):
        try:
            # Check required fields
            required_fields = ['user', 'question_text', 'strategy_name', 'metaPrompt', 'model', 'answer_text']
            if not all(field in data for field in required_fields):
                errors.append({'index': idx, 'error': 'Missing required fields'})
                continue

            # 1. Find the query
            query = session.query(Query).join(Question).filter(
                Question.question == data['question_text'],
                Query.user == data['user']
            ).first()

            if not query:
                return jsonify({
                    'message': 'Operation aborted',
                    'reason': 'Query not found - no entries were processed'
                }), 200 

            # 2. Find strategy
            strategy = session.query(Strategy).filter_by(name=data['strategy_name']).first()
            if not strategy:
                errors.append({'index': idx, 'error': 'Strategy not found'})
                continue

            # 3. Find model
            model = session.query(Model).filter_by(name=data['model']).first()
            if not model:
                errors.append({'index': idx, 'error': 'Model not found'})
                continue

            # 4. Find answer
            answer = session.query(Answer).filter_by(answer=data['answer_text']).first()
            if not answer:
                errors.append({'index': idx, 'error': 'Answer not found'})
                continue

            # 5. Create Metaprompt
            new_metaprompt = Metaprompt(
                query_id=query.id,
                strategy_id=strategy.id,
                model_id=model.id,
                prompt=data['metaPrompt'],
                answer_id=answer.id
            )

            session.add(new_metaprompt)
            results.append({'index': idx, 'status': 'created'})

        except Exception as e:
            session.rollback()
            errors.append({'index': idx, 'error': str(e)})

    try:
        session.commit()
    except Exception as commit_error:
        session.rollback()
        return jsonify({'error': 'Failed to commit metaprompts', 'details': str(commit_error)}), 500
    finally:
        session.close()

    return jsonify({
        'message': 'Metaprompt insert completed',
        'created': results,
        'errors': errors
    }), 207 if errors else 201

@app.route('/api/insert_bestAnswer', methods=['POST'])
def insert_bestAnswer():
    session = Session()
    try:
        # Get data from request
        data = flask_request.get_json()
        query_id = data.get('query_id')
        best_answer_id = data.get('best_answer_id')

        # Validate input
        if not query_id or not best_answer_id:
            return jsonify({"error": "Both query_id and best_answer_id are required"}), 400

        # Check if answer exists
        answer = session.query(Answer).filter_by(id=best_answer_id).first()
        if not answer:
            return jsonify({"error": "Answer not found"}), 404

        # Check if query exists
        query = session.query(Query).filter_by(id=query_id).first()
        if not query:
            return jsonify({"error": "Query not found"}), 404
        
        
        # Check if best answer already exists for this query
        if query.best_answer_id is not None and query.best_answer_id != '':
            return jsonify({
                "message": "This query already has a best answer, it cannot be changed",
                "existing_best_answer_id": query.best_answer_id
            }), 200

        # Verify answer belongs to query
        if answer.query_id != query_id:
            return jsonify({"error": "Answer does not belong to this query"}), 400

        # Update the best answer
        query.best_answer_id = best_answer_id
        session.commit()

        return jsonify({
            "message": "Best answer updated successfully",
            "query_id": query_id,
            "best_answer_id": best_answer_id
        }), 200

    except Exception as e:
        session.rollback()
        return jsonify({"error": f"Database error: {str(e)}"}), 500

    finally:
        session.close()

@app.route('/api/find_answer_by_content', methods=['POST'])
def find_answer_by_content():
    session = Session()
    try:
        data = flask_request.get_json()
        answer_content = data.get('answer_content')
        
        if not answer_content:
            return jsonify({"error": "answer_content is required"}), 400
                

        answer = session.query(Answer).filter(
            Answer.answer == answer_content
        ).order_by(Answer.id.desc()).first()
        
        if answer:
            return jsonify({
                "answer_id": answer.id,
                "query_id": answer.query_id
            }), 200
        
        return jsonify({"error": "Matching answer not found"}), 404
        
    except Exception as e:
        print(f"[ERROR] Exception: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()

@app.route('/api/get_annotated_answer', methods=['POST'])
def get_annotated_answer():
    data = flask_request.get_json()
    query_id = data.get('query_id')
    
    if not query_id:
        return jsonify({'error': 'query_id is required'}), 400   

    session = Session()
    try:        
        query = session.query(Query).filter_by(id=query_id).first()
        if not query:
            return jsonify({'error': 'Query not found'}), 404            
      
        question = session.query(Question).filter_by(id=query.question_id).first()
        if not question:
            return jsonify({'error': 'Question not found'}), 404
            
        return jsonify({
            'annotated_answer': question.correct_answer
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        session.close()


@app.route('/api/prompt', methods=['POST'])
def handle_prompt():
    """
    API endpoint to handle LLM prompts
    Accepts JSON with:
    - prompt: The text prompt to send to the LLM (required)
    - model: Optional model name (defaults to DEFAULT_MODEL)
    
    Returns JSON response with:
    - prompt: The original prompt
    - model: The model used
    - response: The LLM's response
    - error: Present if there was an error
    """
    # Get JSON data from request
    data = flask_request.get_json()

    if not data or 'prompt' not in data:
        return jsonify({
            'error': 'Invalid request. Please provide a "prompt" in the JSON payload.'
        }), 400

    # Extract prompt and model (if provided)
    prompt = data['prompt']
    model = data.get('model', DEFAULT_MODEL)

    # Get response from Ollama
    response = generate_response(prompt, model)

    return jsonify({
        'prompt': prompt,
        'model': model,
        'response': response
    })

def generate_response(prompt, model=None):
    """
    Send a prompt to the LLM and get the response.
    :param prompt: The input prompt/text to send to the model
    :param model: The model to use (default from config)
    :return: Generated response from the LLM
    """
    model = model or DEFAULT_MODEL
    endpoint = f"{OLLAMA_BASE_URL}/api/generate"

    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False
    }

    try:
        response = requests.post(endpoint, json=payload)
        response.raise_for_status()  # Raise exception for HTTP errors
        return response.json().get('response', 'No response received')
    except requests.exceptions.RequestException as e:  # Using requests.exceptions
        return f"Error communicating with Ollama: {str(e)}"

def init_database():
    """Initialize the database by creating all tables and populating initial data"""
    session = None
    try:
        # Create all tables based on the models
        Base.metadata.create_all(engine)
        print("Database tables created successfully!")       

        session = Session()
        
        # Models        
        for model_name in MODELS:
            # Check if model already exists
            existing_model = session.query(Model).filter_by(name=model_name).first()
            if not existing_model:
                model = Model(name=model_name)
                session.add(model)
        
        # Strategies
        print("Adding strategies...")
        for strategy_name in STRATEGIES:
            # Check if strategy already exists
            existing_strategy = session.query(Strategy).filter_by(name=strategy_name).first()
            if not existing_strategy:
                strategy = Strategy(name=strategy_name)
                session.add(strategy)
        
        # Questions
        print("Adding questions...")
        for _, row in filtered_data.iterrows():
            # Check if question already exists
            existing_question = session.query(Question).filter_by(question=row['Question']).first()
            if not existing_question:
                question = Question(
                    type=row['Type'],
                    category=row['Category'],
                    question=row['Question'],
                    correct_answer=row['Correct Answers'],
                    source=row['Source']
                )
                session.add(question)
        
        # Commit all changes
        session.commit()
        print("Database initialization complete!")
        
    except Exception as e:
        if session:
            session.rollback()
        print(f"Error initializing database: {e}")
        raise  # Re-raise the exception after logging
    finally:
        if session:
            session.close()

def get_user_suggestions():
    """Get all users filtered by the query parameter"""
    filter_text = flask_request.args.get('filter', '').lower()
    session = Session()
    
    try:
        # Get all users that contain the filter text
        users = session.query(User.user).filter(User.user.ilike(f'%{filter_text}%')).all()
        # Convert list of tuples to list of strings
        user_list = [user[0] for user in users]
        return jsonify(user_list)
    except Exception as e:
        print(f"Error fetching user suggestions: {e}")
        return jsonify([])
    finally:
        session.close()

def create_user():
    """Create a new user in the database"""
    user_data = flask_request.json
    if not user_data or 'user' not in user_data:
        return jsonify({'error': 'User name is required'}), 400
    
    username = user_data['user'].strip()
    if not username:
        return jsonify({'error': 'User name cannot be empty'}), 400

    session = Session()
    
    try:
        # Check if user already exists
        existing_user = session.query(User).filter_by(user=username).first()
        if existing_user:
            return jsonify({'message': 'User already exists'}), 200
            
        # Create new user
        new_user = User(user=username)
        session.add(new_user)
        session.commit()
        return jsonify({'message': 'User created successfully'}), 201
    except Exception as e:
        session.rollback()
        print(f"Error creating user: {e}")
        return jsonify({'error': 'Failed to create user'}), 500
    finally:
        session.close()

def load_qa_pairs_from_db():
    """
    Load all questions and their correct answers from the database
    into the global QA_PAIRS variable.
    """
    global QA_PAIRS
    session = None
    
    try:
        session = Session()
        
        # Query all questions and convert to plain tuples immediately
        questions = session.query(Question.question, Question.correct_answer).all()
        
        # Convert SQLAlchemy Row objects to plain Python tuples
        QA_PAIRS = tuple((str(q.question), str(q.correct_answer)) for q in questions)
        
        print(f"Loaded {len(QA_PAIRS)} QA pairs into global variable")
        return True
        
    except Exception as e:
        print(f"Error loading QA pairs from database: {e}")
        return False
    finally:
        if session:
            session.close()
            
def get_installed_models():
    """Get all models installed in Ollama"""
    try:        
        response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        # Validiere Response-Struktur
        if not isinstance(data, dict):
            print(f"Expected dict, got {type(data)}")
            return []
            
        models = data.get('models', [])        
        
        if not isinstance(models, list):
            print(f"Expected list for models, got {type(models)}")
            return []
                               
        return [model['name'] for model in models]
        
    except requests.exceptions.ConnectionError:
        print(f"Cannot connect to Ollama at {OLLAMA_BASE_URL}")
        return []
    except requests.exceptions.Timeout:
        print("Request to Ollama timed out")
        return []
    except requests.RequestException as e:
        print(f"Error fetching installed models from Ollama: {e}")
        return []
    except ValueError as e:
        print(f"Invalid JSON response: {e}")
        return []
    except Exception as e:
        print(f"Unexpected error: {e}")
        return []

def wait_for_ollama(max_retries=30, check_interval=0.5):
    """Wait for Ollama service"""
    dots = 0
    for attempt in range(max_retries):
        # Check connection
        try:
            response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=3)
            if response.ok:
                print("\nOllama ready!" + " "*20)  
                return True
        except:  
            pass

        # Update waiting animation
        dots = (dots + 1) % 4  # Cycle 0-3
        print(f"Waiting for Ollama{'.'*dots}", end='\r', flush=True)
        time.sleep(check_interval)
    
    print("\nOllama not responding")
    return False

def start_service():
    """
    Start ollama service via Apptainer.
    """
    
    try:
        # First start the service
        cmd = (f'chmod a+x "{script_path}" && '
               f'"{script_path}" "{RUN_TIMESTAMP}" &')
        
        subprocess.run(cmd, shell=True, check=True)
        
        wait_for_ollama()
        
        # Check missing models
        installed_models = get_installed_models()
        missing_models = set(MODELS) - set(installed_models)            
        
        if missing_models:
            if missing_models:
                print(f'\033[1;91mWarning:\033[0m \033[1mThe following models are missing: [{", ".join(missing_models)}]\033[0m')
                print(f'\n\n------------------------------------\n\n')
                        
    except subprocess.CalledProcessError as e:
        print(f"Error while starting service: {e}")
        return False
    except Exception as e:
        print(f"Unexpected error: {e}")
        return False

def switch_model(new_model):
    """
    Switch to new model.
    
    Args:
        new_model: Model to switch to
    
    Returns:
        bool: True if successful, False otherwise
    """
    if current_model == new_model:
        return True
    
    try:
        # ollama run implies ollama pull if the requested model is not available
        if current_model == 'none':
            cmd = f'apptainer exec instance://{INSTANCE_NAME} ollama run {new_model}'
        else:
            cmd = (f'apptainer exec instance://{INSTANCE_NAME} ollama stop {current_model} && '
                   f'apptainer exec instance://{INSTANCE_NAME} ollama run {new_model}')
        
        result = subprocess.run(cmd, shell=True, check=True)
        return result.returncode
    except subprocess.CalledProcessError as e:
        print(f"Error while switching models: {e}")
        return False
    except Exception as e:
        print(f"Unexpected error: {e}")
        return False

def crude_switch_model(new_model):
    if current_model == new_model:
        pass
    elif current_model == 'none':
        os.system(f'apptainer exec instance://{INSTANCE_NAME} ollama run {new_model}')
    else:
        os.system(f'apptainer exec instance://{INSTANCE_NAME} ollama stop {current_model} && apptainer exec instance://{INSTANCE_NAME} ollama run {new_model}')

@app.route('/table', methods=("POST", "GET"))
def html_table():
    df = pd.read_sql_query("""SELECT u.user as User, q2.question as QuestionText, prompt as Prompt, a.answer as AnswerText, s.name as StrategyName, m.name as ModelName
                                    from metaprompts
                                    join main.queries q on q.id = metaprompts.query_id
                                    join main.answers a on q.id = a.query_id
                                    join main.questions q2 on q.question_id = q2.id
                                    join main.users u on q.user = u.user
                                    join main.models m on a.model = m.id
                                    join main.strategies s on metaprompts.strategy_id = s.id""", engine.connect())

    return render_template("data.html", column_names=df.columns.values, row_data=list(df.values.tolist()),link_column="User", zip=zip)

def get_bert_score(answer:str, truth_answer:str):
    (P, R, F), hashname = bert_score([answer], [truth_answer], lang="en", return_hash=True)
    return {"Precision":P, "Recall":R, "F1":F}

if __name__ == '__main__':
    init_database()
    load_qa_pairs_from_db()
    
    if START_APPTAINER:
        start_service()

    # Using a dynamically assigned free port
    app.run(host='127.0.0.1', port=0, debug=False)