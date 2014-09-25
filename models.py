from sqlalchemy import Column, Table, ForeignKey, Integer, String, DateTime, PrimaryKeyConstraint
from sqlalchemy.ext.declarative import declarative_base, declared_attr
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
    def from_dict(m, db):
        """
        Convert dictionary into proper kwargs for the model constructor.
        """
        return {str(k): v for k, v in m.items()}

person_job = Table('person_job', Base.metadata,
    Column('person_id', Integer, ForeignKey('person.id')),
    Column('job_id', Integer, ForeignKey('job.id')),
    PrimaryKeyConstraint('person_id', 'job_id')
)

class Person(Base, Serializer):
    __tablename__ = 'person'
    __public__ = ["id", "name", "username", "events"]
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    username = Column(String, unique=True)
    events = relationship("personEvent", backref="person", cascade="all, delete, delete-orphan")

    @staticmethod
    def from_dict(m, db):
        m = Serializer.from_dict(m, db)
        if m.get("events", False):
            reqs = []
            newreqs = []
            for req in m["events"]:
                pe = db.query(personEvent).get((req["id"], m["id"]))
                if not pe:
                    pe = personEvent(requirement=req["requirement"])
                    pe.event = db.query(Event).get(req["id"])
                else:
                    if pe.requirement != req["requirement"]:
                        pe.requirement = req["requirement"]
                reqs.append(pe)
            m["events"] = reqs
        return m

    def to_dict(self):
        dct = super(Person, self).to_dict()
        if dct.get("events", False):
            dct["events"] = [{"requirement": r.requirement, "id": r.event.id} for r in dct["events"]]
        return dct

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
    def from_dict(m, db):
        m = Serializer.from_dict(m, db)
        if m.get("time", False):
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
    # http://stackoverflow.com/questions/2310153/inserting-data-in-many-to-many-relationship-in-sqlalchemy
    __tablename__ = 'job'
    __public__ = ["id", "name", "people", "events"]
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    people = relationship("Person", secondary=person_job, backref="people")
    events = relationship("jobEvent", backref="job", cascade="all, delete, delete-orphan")

    @staticmethod
    def from_dict(m, db):
        m = Serializer.from_dict(m, db)
        if m.get("people", False):
            m["people"] = list(set(m["people"]))
            m["people"] = [db.query(Person).filter(Person.username == p)[0] for p in m["people"] if db.query(Person).filter(Person.username == p).count() > 0]
        if m.get("title_sanitized", False):
            del m["title_sanitized"]
        if m.get("events", False):
            reqs = []
            newreqs = []
            for req in m["events"]:
                je = db.query(jobEvent).get((req["id"], m["id"]))
                if not je:
                    je = jobEvent(requirement=req["requirement"])
                    je.event = db.query(Event).get(req["id"])
                else:
                    if je.requirement != req["requirement"]:
                        je.requirement = req["requirement"]
                reqs.append(je)
            m["events"] = reqs
        return m

    def to_dict(self):
        dct = super(Job, self).to_dict()
        if dct.get("people", False):
            dct["people"] = [p.username for p in dct["people"]]
        if dct.get("events", False):
            dct["events"] = [{"requirement": r.requirement, "id": r.event.id} for r in dct["events"]]
        return dct

class Association(object):
    pass

class EventMixin(Association):
    @declared_attr
    def event_id(cls):
        return Column(Integer, ForeignKey('event.id'), primary_key=True)
    @declared_attr
    def event(cls):
        return relationship("Event")
    requirement = Column(String, nullable=False)

class jobEvent(EventMixin, Base):
    __tablename__ = 'jobEvent'
    job_id = Column(Integer, ForeignKey('job.id'), primary_key=True)

class personEvent(EventMixin, Base):
    __tablename__ = 'personEvent'
    person_id = Column(Integer, ForeignKey('person.id'), primary_key=True)

engine = create_engine('sqlite:///schedule.db')
Base.metadata.create_all(engine)
