#!/usr/bin/env python

# -*- coding: utf-8 -*-

"""
Convert questions for the famous Penta News Game Show from
some yaml format to json.

It's just a helper to write the questions in a more human
readeable format assuming yaml is more human readable


TODO:
    * Add own constructor to Question() / nice to have
    * Deal with media files
"""

__author__ = "Frank Becker <fb@alien8.de>"
__version__ = "0.0.2"
__date__ = "Fri 18 Nov 2011 18:10:44 CET"
__copyright__ = "Copyright (c) 2011 Frank Becker"
__license__ = "Python"

import os
import sys
import json
from optparse import OptionParser

try:
    import yaml
except ImportError:
    print 'You need to install PyYAML first. E. g. "pip install pyyaml"'


class Question(yaml.YAMLObject):
    """Represents a question
    """
    yaml_tag = u"!Question"

    # {round_no1: [tier1, tier2, ...], round_no2: [tier1, ...]}
    registered_questions = {}
    points = {
       1: 100,
       2: 150,
       3: 225,
       4: 337,
       5: 506,
       6: 759,
       7: 1139,
       8: 1709,
       9: 2563,
       10: 3844,
       11: 5555,
       12: 7531,
    }

    def __init__(self, question=u"", tier=0, answers=[], game_round=0,
                 media=("", "", ""), media_path=""):
        """docstring for __init__
           @question - the Question 
           @rank - number of the question in the game
           @game_round - number of the round in the game
           @answers - list of answers, assumed are 4
           @media - (media show at question time, media shown at answer time,
                     media shown at resolution time)
           @media_path - path to the media files
        """
        self.question = question
        self.answers = answers
        self.tier = tier
        self.game_round = game_round
        self.media = media
        self.media_path = media_path

    def __type_by_extension(self, media_file):
        """returns the media type looked up by it's extension
        FIXME (a8): maybe use file magic in the future

        @media_file - path to the media file
        """
        media_types = dict(
            video = ('webm'),
            image = ('png', 'jpg', 'gif'),
        )
        if not os.path.isfile(media_file):
            raise IOError("The file {0} does not exist.".format(media_file,))
        ext = media_file.rsplit('.', 1)[1]
        for k, v in media_types.items():
            if ext in v:
                return k
        raise KeyError("Media type for {0} not found".format(media_file,))

    def __repr__(self):
        """docstring for __repr__"""
        return "%s(%r)" % (self.__class__.__name__, self.question)

    @property
    def as_dict(self):
        """dump data suiteable for json conversion"""

        data = {}
        data['text'] = self.question
        data['tier'] = self.points.get(int(self.tier), 0)
        data['answers'] = [
            {'text': answer[False]} if answer.has_key(False) \
            else {'text': answer[True], 'right': True} \
            for answer in self.answers
        ]
        if hasattr(self, 'media'):
            def gen_questions():
                q_data = {}
                for f in self.media['question']:
                    q_data[self.__type_by_extension(
                        os.path.sep.join(os.path.join([self.media_path, f]))
                    )] = f
                return q_data
            def gen_explanation():
                return {'explanation': self.media['explanation']}
            def k_not_found():
                raise KeyError("Media keyword not found")

            for k in self.media.keys():
                m_data = dict(
                    question = gen_questions,
                     explanation= gen_explanation,
                    k_not_found = "lambda x: pass",
                ).get(k, 'k_not_found')()
                for key, value in m_data.items():
                    data[key] = value
        return data

    @classmethod
    def get_points(cls):
        """docstring for get_points"""
        for key in sorted(cls.points.keys()):
            yield cls.points[key]

    @staticmethod
    def register_question(obj):
        """register object in class so no question with the
        same tier/round combo can exist"""
        if Question.registered_questions.has_key(obj.game_round) and \
           obj.tier in Question.registered_questions[obj.game_round]:
            raise IndexError("Slot for Question {0} is alredy taken".format(
                obj.question,))
        elif Question.registered_questions.has_key(obj.game_round):
            Question.registered_questions[obj.game_round].append(obj.tier)
        else:
            Question.registered_questions[obj.game_round] = [obj.tier]


def init_parser():
    """Read command line options

    returns:
    options:dict  -- config options
    """
    parser = OptionParser()

    parser.add_option(
        "-d",
        "--debug",
        dest="debug",
        help="Toggle debugging",
        action="store_true",
        default=False,
    )

    parser.add_option(
        "-f",
        "--questions-file",
        dest="file",
        help=("Use this file instead of the default "
              "questions.yaml"),
        metavar="FILE",
    )

    parser.add_option(
        "-v",
        "--version",
        dest="version",
        help="Show program version",
        action="store_true",
        default=False,
    )

    options = parser.parse_args()[0]
    return options

def questions_per_round(questions, game_round=None):
    """docstring for questions_per_round"""
    return [q for q in questions if q.game_round == game_round]

def main():
    """docstring for main"""

    options = init_parser()
    if options.version:
        print "Version: {0}".format(__version__,)
        sys.exit()

    if options.file:
        questions_fh = open(options.file)
    else:
        questions_fh = open('questions.yaml')

    questions = []
    for q in yaml.load_all(questions_fh.read()):
        #FIXME (fb@alien8.de) 11-11-18 23:16:34 use yaml constructor
        # yaml.add_constructor
        Question.register_question(q)
        if options.file:
            q.media_path = os.path.abspath(os.path.dirname(options.file))
        questions.append(q)
    if options.debug:
        print Question.registered_questions
        print [q.media for q in questions]

    game_rounds = sorted(Question.registered_questions.keys())
    for r in game_rounds:
        print json.dumps([q.as_dict for q in questions_per_round(
            questions, game_round=r)], indent=2)

if __name__ == '__main__':
    main()

# vim: tabstop=4 expandtab shiftwidth=4 softtabstop=4 fileencoding=utf-8 :

