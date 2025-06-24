from sqlalchemy import DateTime, Column, String, Integer, Float, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from enum import Enum

Base = declarative_base()


# Python Enums definieren
class QuestionType(str, Enum):
    ADVERSARIAL = "Adversarial"
    NON_ADVERSARIAL = "Non-Adversarial"

class QuestionCategory(str, Enum):
    # Adversarial categories
    MISCONCEPTIONS = "Misconceptions"
    HEALTH = "Health"
    NUTRITION = "Nutrition"
    
    # Non-Adversarial categories
    CONFUSION_PLACES = "Confusion: Places"
    CONFUSION_OTHER = "Confusion: Other"
    WEATHER = "Weather"
    STATISTICS = "Statistics"
    HISTORY = "History"
    LOGICAL_FALSEHOOD = "Logical Falsehood"

class User(Base):
    """User table to store user information"""
    __tablename__ = 'users'
    
    user = Column(String, primary_key=True)
    
class Model(Base):
    """Model table to store different AI models"""
    __tablename__ = 'models'
    
    id = Column(Integer, primary_key=True)
    name = Column(String)

    answers = relationship("Answer", back_populates="model_rel")

class Strategy(Base):
    """Strategy table to store different prompting strategies"""
    __tablename__ = 'strategies'
    
    id = Column(Integer, primary_key=True)
    name = Column(String)
    
class Question(Base):
    """Question table to store questions with reference answers"""
    __tablename__ = 'questions'
    
    id = Column(Integer, primary_key=True)
    type = Column(SQLEnum(QuestionType), nullable=False)
    category = Column(SQLEnum(QuestionCategory), nullable=False)
    question = Column(Text)
    correct_answer = Column(Text)
    source = Column(Text)

class QuestionCounter(Base):
    """Counts of how often each user repeats specific questions."""
    __tablename__ = 'question_counters'
    
    user = Column(String, ForeignKey('users.user'), primary_key=True)
    question_id = Column(Integer, ForeignKey('questions.id'), primary_key=True,)
    count = Column(Integer, default=0)

class Query(Base):
    """Query table to link users with questions and best answers"""
    __tablename__ = 'queries'
    
    user = Column(String, ForeignKey('users.user'))
    id = Column(Integer, primary_key=True)
    question_id = Column(Integer, ForeignKey('questions.id'))
    best_answer_id = Column(Integer, ForeignKey('answers.id'))
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

class Answer(Base):
    """Answer table to store generated answers with metadata"""
    __tablename__ = 'answers'
    
    id = Column(Integer, primary_key=True)
    answer = Column(Text)
    model = Column(Integer, ForeignKey('models.id'))
    feedback_id = Column(Integer, ForeignKey('feedback.id'))
    response_time = Column(Float)
    query_id = Column(Integer, ForeignKey('queries.id'))
    position = Column(Integer)
    precision = Column(Float)
    recall = Column(Float)
    f1 = Column(Float)
    
   
    prompt_eval_count = Column(Integer)  # Number of tokens in input
    eval_count = Column(Integer)         # Number of tokens in output
    total_tokens = Column(Integer)       # Total number of tokens
    
    model_rel = relationship("Model")
    
class Feedback(Base):
    """Feedback table to store quality ratings for answers"""
    __tablename__ = 'feedback'
    
    user = Column(String, ForeignKey('users.user'))
    id = Column(Integer, primary_key=True)
    accuracy = Column(Float)
    completeness = Column(Float)
    relevance = Column(Float)
    coherence = Column(Float)
    clarity = Column(Float)

class Metaprompt(Base):
    """Metaprompt table to store prompting experiments"""
    __tablename__ = 'metaprompts'
    
    id = Column(Integer, primary_key=True)
    query_id = Column(Integer, ForeignKey('queries.id'))
    strategy_id = Column(Integer, ForeignKey('strategies.id'))
    prompt = Column(Text)
    model_id = Column(Integer, ForeignKey('models.id'))
    answer_id = Column(Integer, ForeignKey('answers.id'))

    prompt_eval_count = Column(Integer)  # Number of tokens in input
    eval_count = Column(Integer)         # Number of tokens in output
    total_tokens = Column(Integer)       # Total number of tokens

    model = relationship("Model", foreign_keys=[model_id])
    strategy = relationship("Strategy", foreign_keys=[strategy_id])
    answer = relationship("Answer", foreign_keys=[answer_id])
    query = relationship("Query", foreign_keys=[query_id])
