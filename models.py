from sqlalchemy import Column, ForeignKey, Integer, String, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy import create_engine

Base = declarative_base()

class Person(Base):
    __tablename__ = 'person'
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    username = Column(String, nullable=False)
    events = relationship("personEvent")

class Event(Base):
    __tablename__ = 'event'
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    time_start = Column(DateTime, nullable=False)
    time_end = Column(DateTime, nullable=False)
    place = Column(String)
    description = Column(String)

class Job(Base):
    __tablename__ = 'job'
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    people = relationship("Person")
    events = relationship("jobEvent")

class jobEvent(Base):
    __tablename__ = 'jobEvent'
    event_id = Column(Integer, ForeignKey('event.id'), primary_key=True)
    requirement = Column(String, nullable=False)
    job_id = Column(Integer, ForeignKey('job.id'), primary_key=True)
    job = relationship("Job")

class personEvent(Base):
    __tablename__ = 'personEvent'
    event_id = Column(Integer, ForeignKey('event.id'), primary_key=True)
    requirement = Column(String, nullable=False)
    person_id = Column(Integer, ForeignKey('person.id'), primary_key=True)
    person = relationship("Person")

engine = create_engine('sqlite:///schedule.db')
Base.metadata.create_all(engine)
