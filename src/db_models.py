from sqlalchemy import Column, String, Integer, Float, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()

class User(Base):
    """User table to store user information"""
    __tablename__ = 'users'
    
    user = Column(String, primary_key=True)
    
class Model(Base):
    """Model table to store different AI models"""
    __tablename__ = 'models'
    
    id = Column(Integer, primary_key=True)
    name = Column(String)

class Strategy(Base):
    """Strategy table to store different prompting strategies"""
    __tablename__ = 'strategies'
    
    id = Column(Integer, primary_key=True)
    name = Column(String)
    
class Question(Base):
    """Question table to store questions with reference answers"""
    __tablename__ = 'questions'
    
    id = Column(Integer, primary_key=True)
    question = Column(Text)
    reference_answer = Column(Text)


class Query(Base):
    """Query table to link users with questions and best answers"""
    __tablename__ = 'queries'
    
    user = Column(String, ForeignKey('users.user'), primary_key=True)
    id = Column(Integer, primary_key=True)
    question_id = Column(Integer, ForeignKey('questions.id'))
    best_answer_id = Column(Integer, ForeignKey('answers.id'))

class Answer(Base):
    """Answer table to store generated answers with metadata"""
    __tablename__ = 'answers'
    
    user = Column(String, ForeignKey('users.user'), primary_key=True)
    id = Column(Integer, primary_key=True)
    answer = Column(Text)
    model = Column(Integer, ForeignKey('models.id'))
    feedback_id = Column(Integer, ForeignKey('feedback.id'))
    response_time = Column(Float)
    query_id = Column(Integer, ForeignKey('queries.id'))
    position = Column(Integer)
    score = Column(Float)
    
class Feedback(Base):
    """Feedback table to store quality ratings for answers"""
    __tablename__ = 'feedback'
    
    user = Column(String, ForeignKey('users.user'), primary_key=True)
    id = Column(Integer, primary_key=True)
    accuracy = Column(Float)
    completeness = Column(Float)
    relevance = Column(Float)
    coherence = Column(Float)
    clarity = Column(Float)

class Metaprompt(Base):
    """Metaprompt table to store prompting experiments"""
    __tablename__ = 'metaprompts'
    
    user = Column(String, ForeignKey('users.user'), primary_key=True)
    id = Column(Integer, primary_key=True)
    query_id = Column(Integer, ForeignKey('queries.id'))
    strategy_id = Column(Integer, ForeignKey('strategies.id'))
    prompt = Column(Text)
    model_id = Column(Integer, ForeignKey('models.id'))
    answer_id = Column(Integer, ForeignKey('answers.id'))
