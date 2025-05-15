from flask import Flask, render_template
import os

# Initialize Flask application
app = Flask(__name__, static_folder='static', template_folder='templates')
app.secret_key = os.urandom(24)  # Secret key for session management
app.config['PERMANENT_SESSION_LIFETIME'] = 30 * 24 * 3600 


@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    app.run(debug=True)