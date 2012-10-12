#!/usr/bin/env python

# -*- coding: utf-8 -*-

"""
Convert questions for the famous Penta News Game Show from
some yaml format to json.

It's just a helper to write the questions in a more human
readeable format assuming yaml is more human readable

Note:
    - Media files are looked for relative to the questions file
    - Media files are expected relative to the generated json files

TODO:
    * Add own constructor to Question() / nice to have
    * Use import logging for debug logging
"""

__author__ = "Frank Becker <fb@alien8.de>"
__version__ = "0.0.2"
__date__ = "Fri 18 Nov 2011 18:10:44 CET"
__copyright__ = "Copyright (c) 2011 Frank Becker"
__license__ = "Python"

import os
import sys
import random
import json
from reportlab.lib.pagesizes import A5, LETTER, landscape, portrait
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm
from reportlab.platypus.flowables import PageBreak
from optparse import OptionParser

try:
    import yaml
except ImportError:
    print 'You need to install PyYAML first. E. g. "pip install pyyaml"'


class Question(yaml.YAMLObject):
    """Represents a question
    """
    yaml_tag = u"!Question"
    web_root = "data"

    # Generate random points in range of points_per_round
    gen_random_points = True
    points_per_round = {
        1: (1, 100),
        2: (100, 1000),
        3: (10000, 100000),
        4: (5, 42),
        5: (13, 80),
    }

    # {round_no1: [tier1, tier2, ...], round_no2: [tier1, ...]}
    registered_questions = {}

    def __init__(self, question=u"", tier=0, answers=[], game_round=0,
                 media=("", "", ""), media_path="data", web_root="data"):
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
        self.web_root = web_root

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

    def _get_points(self, game_round, tier):
        """returns the points by game_round/tier combo"""

        points_fixed = {
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

        if not self.gen_random_points:
            return points_fixed.get(tier, 0)

        range = self.points_per_round.get(game_round)
        points = random.randint(*range)
        return points

    @property
    def as_dict(self):
        """dump data suiteable for json conversion"""

        data = {}
        data['text'] = self.question
        data['tier'] = self._get_points(int(self.game_round), int(self.tier))
        try:
            data['source'] = self.source
        except AttributeError:
            data['source'] = False
        print self.question
        print self.answers
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
                    )] = os.sep.join([self.web_root, f])
                return q_data
            def gen_explanation():
                """Sorry, hacky. Quick fix required only 1st element is taken"""
                f = self.media['explanation'][0]
                k = self.__type_by_extension(os.path.sep.join(
                    os.path.join([self.media_path, f])))
                v = [os.sep.join([self.web_root, expl]) \
                            for expl in self.media['explanation']]
                if v:
                    v = v[0]
                else:
                    v = ""
                return {'explanation': {k: v}}
                                #): os.sep.join([self.web_root, f])

                            #[os.sep.join([self.web_root, expl]) \
                            #            for expl in self.media['explanation']]}
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

    @property
    def as_pdf_dict(self):
        """Return full data set. Includes comment field"""
        data = self.as_dict
        try:
            data['comment'] = self.comment
        except AttributeError:
            data['comment'] = ""

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
        "-p",
        "--generate-pdf",
        dest="pdf",
        help=("Generate the speaker PDF"),
        action="store_true",
        default=False,
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

def write_json_file(questions):
    """docstring for write_json_file"""
    game_round = questions[0].game_round
    file_name = 'round_{0}.json'.format(game_round)
    fh = open(file_name, 'w')
    fh.writelines(json.dumps([q.as_dict for q in questions], indent=2))

def gen_pdf(questions, game_rounds):
    """generate speaker PDF"""

    styles = getSampleStyleSheet()
    doc = SimpleDocTemplate("pngs-speaker.pdf")
    doc.pagesize = landscape(A5)
    style = styles["Normal"]
    page_elements = []
    for round in game_rounds:
        for num, question in enumerate(
            questions_per_round(questions, game_round=round)):
            q_data = question.as_pdf_dict
            page_elements.append(
                Paragraph("<em>Game Round</em>: {0}".format(round),
                          style)
            )
            page_elements.append(Spacer(0, 0.1*cm))
            page_elements.append(
                Paragraph(
                    "<font size=12><em>Question {0}:</em> <bold>{1}</bold>"
                    "</font>".format(num + 1, q_data['text'].encode('utf-8')),
                          style)
            )
            page_elements.append(Spacer(0, 0.2*cm))
            page_elements.append(
                Paragraph("<em>Comment</em>: {0}".format(q_data.get('comment').encode('utf-8')),
                style)
            )
            page_elements.append(Spacer(0, 0.2*cm))
            page_elements.append(
                Paragraph("<em>Answers</em>:",
                          style)
            )
            page_elements.append(
                Paragraph("* " + "<br />* ".join([unicode(t['text']) for t in q_data['answers']]),
                          style)
            )
            page_elements.append(
                Paragraph("<em>Points</em>: {0}".format(q_data.get('tier')),
                          style)
            )
            page_elements.append(PageBreak())
    doc.build(page_elements)
    return

    Story = [Spacer(0, 1*cm)]
    p = Paragraph("Blubber1", styles["Normal"])
    Story.append(p)
    p = Paragraph("Blubber2", styles["Normal"])
    Story.append(p)
    Story.append(Spacer(10, 5*cm))
    p = Paragraph("Blubber3", styles["Normal"])
    Story.append(p)
    #doc.build(Story, onFirstPage=myFirstPage, onLaterPages=myLaterPages)
    doc.build(Story)

def gen_answers_html(questions, game_rounds):
    """generate html"""
    fh = open("answers.html", 'w')
    html_header = """
    <html>
    <head>
        <title></title>
    </head>
    <body>
    """
    html_footer = """

    </body>
    </html>
    """
    #fh.write(html_header)
    fh.write('<ul>\n')
    for round in game_rounds:
        fh.write('<h2>Game Round {0}</h2>\n'.format(round))
        for num, question in enumerate(
            questions_per_round(questions, game_round=round)):
            fh.write('<li>')
            print question.question
            fh.write(u'Question {0}: {1}<br />'.format(num + 1, question.question))
            answers = ['<link href="{0}">Link {1}</link> '.format(s, n) \
                for n, s in enumerate(question.source.split())]
            #encode('utf-8')),
            fh.writelines(", ".join(answers))
            fh.write('</li>\n')
    fh.write('</ul>\n')
    #fh.write(html_footer)
    fh.close()

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
        write_json_file(questions_per_round(questions, game_round=r))
        if options.debug:
            print "Written file for game round: {0}".format(r)

    if options.pdf:
        gen_pdf(questions, game_rounds)

    #gen_answers_html(questions, game_rounds)

if __name__ == '__main__':
    main()

# vim: tabstop=4 expandtab shiftwidth=4 softtabstop=4 fileencoding=utf-8 :

