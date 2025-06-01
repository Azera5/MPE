from sqlalchemy import Column, String, Integer, Float, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()

class User(Base):
    """User table to store user information"""
    __tablename__ = 'users'
    
    user = Column(String, primary_key=True)
    
    # Relationships
    queries = relationship("Query", back_populates="user_ref")
    answers = relationship("Answer", back_populates="user_ref")
    feedbacks = relationship("Feedback", back_populates="user_ref")
    metaprompts = relationship("Metaprompt", back_populates="user_ref")

class Model(Base):
    """Model table to store different AI models"""
    __tablename__ = 'models'
    
    id = Column(Integer, primary_key=True)
    name = Column(String)
    
    # Relationships
    answers = relationship("Answer", back_populates="model_ref")
    metaprompts = relationship("Metaprompt", back_populates="model_ref")

class Strategy(Base):
    """Strategy table to store different prompting strategies"""
    __tablename__ = 'strategies'
    
    id = Column(Integer, primary_key=True)
    name = Column(String)
    
    # Relationships
    metaprompts = relationship("Metaprompt", back_populates="strategy_ref")

class Question(Base):
    """Question table to store questions with reference answers"""
    __tablename__ = 'questions'
    
    id = Column(Integer, primary_key=True)
    question = Column(Text)
    reference_answer = Column(Text)
    
    # Relationships
    queries = relationship("Query", back_populates="question_ref")
    answers = relationship("Answer", back_populates="query_question", 
                          primaryjoin="Question.id == foreign(Answer.query_id)")

class Query(Base):
    """Query table to link users with questions and best answers"""
    __tablename__ = 'queries'
    
    user = Column(String, ForeignKey('users.user'), primary_key=True)
    id = Column(Integer, primary_key=True)
    question_id = Column(Integer, ForeignKey('questions.id'))
    best_answer_id = Column(Integer, ForeignKey('answers.id'))
    
    # Relationships
    user_ref = relationship("User", back_populates="queries")
    question_ref = relationship("Question", back_populates="queries")
    best_answer_ref = relationship("Answer", foreign_keys=[best_answer_id])

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
    
    # Relationships
    user_ref = relationship("User", back_populates="answers")
    model_ref = relationship("Model", back_populates="answers")
    feedback_ref = relationship("Feedback", foreign_keys=[feedback_id])
    query_ref = relationship("Query", foreign_keys=[query_id])

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
    
    # Relationships
    user_ref = relationship("User", back_populates="feedbacks")

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
    
    # Relationships
    user_ref = relationship("User", back_populates="metaprompts")
    strategy_ref = relationship("Strategy", back_populates="metaprompts")
    model_ref = relationship("Model", back_populates="metaprompts")
    query_ref = relationship("Query", foreign_keys=[query_id])
    answer_ref = relationship("Answer", foreign_keys=[answer_id])