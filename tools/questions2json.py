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
    * Fix to output only questions per round as json
"""

__author__ = "Frank Becker <fb@alien8.de>"
__version__ = "0.0.1"
__date__ = "Fri 18 Nov 2011 18:10:44 CET"
__copyright__ = "Copyright (c) 2011 Frank Becker"
__license__ = "Python"

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
                 media=("", "", "")):
        """docstring for __init__
           @question - the Question 
           @rank - number of the question in the game
           @game_round - number of the round in the game
           @answers - list of answers, assumed are 4
           @media - (media show at question time, media shown at answer time,
                     media shown at resolution time)
        """
        self.question = question
        self.answers = answers
        self.tier = tier
        self.game_round = game_round
        self.media = media

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

#        if os.path.isfile("pix/{0}_expl.jpg".format(arg[7])):
#            data['explanation'] = {
#                'image': "pix/{0}_expl.jpg".format(arg[7])}
#        if os.path.isfile("pix/{0}_expl.gif".format(arg[7])):
#            data['explanation'] = {
#                'image': "pix/{0}_expl.gif".format(arg[7])}
#        if os.path.isfile("pix/{0}.jpg".format(arg[7])):
#           data['image'] = "pix/{0}.jpg".format(arg[7])
#        if os.path.isfile("video/{0}.webm".format(arg[7])):
#           data['video'] = "video/{0}.webm".format(arg[7])
#        if os.path.isfile("video/{0}_expl.webm".format(arg[7])):
#            data['explanation'] = {
#                'video': "video/{0}_expl.webm".format(arg[7])}
#

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
        questions.append(q)
    if options.debug:
        print Question.registered_questions
    print json.dumps([q.as_dict for q in questions], indent=2)

if __name__ == '__main__':
    main()

# vim: tabstop=4 expandtab shiftwidth=4 softtabstop=4 fileencoding=utf-8 :

