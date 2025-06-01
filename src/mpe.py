from flask import Flask, render_template, jsonify, request as flask_request  # Renamed to avoid confusion
import os
import requests 

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from db_models import Base, User, Model, Strategy, Question, Query, Answer, Feedback, Metaprompt

# Initialize Flask application
app = Flask(__name__, static_folder='static', template_folder='templates')
app.secret_key = os.urandom(24)  # Secret key for session management
app.config['PERMANENT_SESSION_LIFETIME'] = 30 * 24 * 3600 

# Database configuration
DATABASE_URL = 'sqlite:///mpe_database.db'  # SQLite database file
engine = create_engine(DATABASE_URL, echo=True)  # echo=True for SQL debugging
SessionLocal = sessionmaker(bind=engine)

# Ollama configuration
OLLAMA_BASE_URL = 'http://localhost:11434'  # Default Ollama URL
DEFAULT_MODEL = 'llama3.1:8b'  # Default model to use if none specified

@app.route('/')
def index():
    """Render the main index page"""
    return render_template('index.html')

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
        # Use requests library (not flask_request) for outgoing requests
        response = requests.post(endpoint, json=payload)
        response.raise_for_status()  # Raise exception for HTTP errors
        return response.json().get('response', 'No response received')
    except requests.exceptions.RequestException as e:  # Using requests.exceptions
        return f"Error communicating with Ollama: {str(e)}"

def init_database():
    """Initialize the database by creating all tables"""
    try:
        # Create all tables based on the models
        Base.metadata.create_all(engine)
        print("Database tables created successfully!")
                  
    except Exception as e:
        print(f"Error creating database: {e}")

def get_db_session():
    """Get a database session"""
    return SessionLocal()

if __name__ == '__main__':
    init_database()
    
    app.run(debug=True)
    