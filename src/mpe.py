from flask import Flask, render_template, jsonify, request as flask_request  # Renamed to avoid confusion
import os
import subprocess
import requests 

from sqlalchemy import create_engine, exists

from sqlalchemy.orm import sessionmaker
from datetime import datetime

import pandas as pd
import numpy as np

from db_models import Base, User, Model, Strategy, Question, Query, Answer, Feedback, Metaprompt

from globals import MODELS, QA_PAIRS, STRATEGIES
from pathlib import Path

# Initialize Flask application
app = Flask(__name__, static_folder='static', template_folder='templates')
app.secret_key = os.urandom(24)  # Secret key for session management
app.config['PERMANENT_SESSION_LIFETIME'] = 30 * 24 * 3600

src_dir = Path(__file__).parent
script_path = src_dir / "start_service.sh"
log_path = src_dir / ".logs" 

# Database configuration
DATABASE_URL = 'sqlite:///mpe_database.db'  # SQLite database file
engine = create_engine(DATABASE_URL, echo=False)  # echo=True for SQL debugging
SessionLocal = sessionmaker(bind=engine)

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
        "stream": False  # We want a single response, not a stream
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
        
        # Create a session to add data
        Session = sessionmaker(bind=engine)
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
        for question_text, reference_answer in QA_PAIRS:
            # Check if question already exists
            existing_question = session.query(Question).filter_by(question=question_text).first()
            if not existing_question:
                question = Question(question=question_text, reference_answer=reference_answer)
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


def get_db_session():
    """Get a database session"""
    return SessionLocal()

# ollama run implies ollama pull if the requested model is not available
def start_service():
    """
    Start ollama service via Apptainer.
    """
    # if current_model == new_model:
    #     return True
    
    try:
        cmd = (f'chmod a+x "{script_path}" && '
               f'"{script_path}" "{RUN_TIMESTAMP}" &')
        
        result = subprocess.run(cmd, shell=True, check=True)
        return result.returncode
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

# crude service interactions, for test purposes only
def crude_start_service():
    os.system(f'chmod a+x "{script_path}" && "{script_path}" "{RUN_TIMESTAMP}"')

def crude_switch_model(new_model):
    if current_model == new_model:
        pass
    elif current_model == 'none':
        os.system(f'apptainer exec instance://{INSTANCE_NAME} ollama run {new_model}')
    else:
        os.system(f'apptainer exec instance://{INSTANCE_NAME} ollama stop {current_model} && apptainer exec instance://{INSTANCE_NAME} ollama run {new_model}')


@app.route('/table', methods=("POST", "GET"))
def html_table():
    df = pd.read_sql_query("""SELECT *
                              from metaprompts
                                       join main.queries q on q.id = metaprompts.query_id
                                       join main.answers a on q.id = a.query_id
                                       join main.questions q2 on q.question_id = q2.id
                                       join main.users u on q.user = u.user
                                       join main.feedback f on a.feedback_id = f.id
                                       join main.models m on a.model = m.id
                                       join main.strategies s on metaprompts.strategy_id = s.id""", engine.connect())

    return render_template('data.html', active_tab='table', tables=[df.to_html(classes='data', header="true")])

if __name__ == '__main__':
    init_database()
    start_service()
    
    # Using a dynamically assigned free port
    app.run(host='127.0.0.1', port=0)