from sqlalchemy import Column, Table, ForeignKey, Integer, String, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy import create_engine

from datetime import datetime

Base = declarative_base()

class Serializer(object):
    __public__ = None

    def to_dict(self):
        dct = {}
        if self.__public__:
            for public_key in self.__public__:
                value = getattr(self, public_key)
                if value:
                    if type(value) is datetime:
                        value = value.strftime("%Y-%m-%dT%H:%M:%S")
                    dct[public_key] = value
        return dct

    @staticmethod
    def from_dict(m):
        """
        Convert dictionary into proper kwargs for the model constructor.
        """
        return m;

person_job = Table('person_job', Base.metadata,
    Column('person_id', Integer, ForeignKey('person.id')),
    Column('job_id', Integer, ForeignKey('job.id'))
)

class Person(Base, Serializer):
    __tablename__ = 'person'
    __public__ = ["id", "name", "username", "events"]
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    username = Column(String, nullable=False)
    events = relationship("personEvent")

class Event(Base, Serializer):
    __tablename__ = 'event'
    __public__ = ["id", "name", "time_start", "time_end", "place", "description"]
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    time_start = Column(DateTime, nullable=False)
    time_end = Column(DateTime, nullable=False)
    place = Column(String)
    description = Column(String)

    @staticmethod
    def from_dict(m):
        m["time_start"] = datetime.strptime(m["time"]["start"][0:19], "%Y-%m-%dT%H:%M:%S")
        m["time_end"] = datetime.strptime(m["time"]["end"][0:19], "%Y-%m-%dT%H:%M:%S")
        del m["time"]
        return m

    def to_dict(self):
        dct = super(Event, self).to_dict()
        dct["time"] = {
                "start": dct["time_start"],
                "end": dct["time_end"]
            }
        del dct["time_start"]
        del dct["time_end"]
        return dct

class Job(Base, Serializer):
    __tablename__ = 'job'
    __public__ = ["id", "name", "people", "events"]
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    people = relationship("Person", secondary=person_job)
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
