#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Convert special crafted csv data into what a8 believes will be accepted by
the Penta News Game Show software

just run the program. It looks for a file called news_entries_27c3.csv
Note, this file has to be formated like that or everything will fail.
The 
'','','','','','','','',
line has to be in there. The file has to stop with such a line.

The best control over font sizes can be achieved using heading tags (<h1>, <h2>, <h3>, etc.). The <big> and <small> tags are not as robust as they are in HTML, but you
will find that they allow you to adjust the size up or down a couple of sizes. The font-size property in CSS is essentally useless.

Use the custom <mbp:pagebreak /> tags to mark pagebreaks in the text. I suggest you include one in front of every chapter or section.

The Kindle has built-in bookmarks for the Table of Contents and the start of the book's content. Use the following anchor tags to mark those places in your book: <a
name="TOC"/> and <a name="start"/>. Place the anchors right after the page break tag, before any headings or paragraphs.
"""

import os
import csv
import json

HTML_HEADER = """
<html>
<head>
</head>
<body>
<h1>27c3 Penta News Game Show Questions</h1>
<i>Your opponents will be riddled as well.</i>
<mbp:pagebreak />
"""
HTML_FOOTER = """
</body>
"""

class Question(object):
    """Represent a game question"""
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

    def __init__(self, arg):
        super(Question, self).__init__()
        self._init_data(arg)
        
    def _init_data(self, arg):
        """initialise all the data"""
        self.data = {}
        self.data['text'] = arg[1]
        self.data['tier'] = self.points.get(int(arg[0]))
        self.data['answers'] = [
            {'text': val} if num +1 != int(arg[6]) \
            else {'text': val, 'right': True} \
            for num, val in enumerate(arg[2:6])
        ]
        return

        if os.path.isfile("pix/{0}_expl.jpg".format(arg[7])):
            self.data['explanation'] = {
                'image': "pix/{0}_expl.jpg".format(arg[7])}
        if os.path.isfile("pix/{0}_expl.gif".format(arg[7])):
            self.data['explanation'] = {
                'image': "pix/{0}_expl.gif".format(arg[7])}
        if os.path.isfile("pix/{0}.jpg".format(arg[7])):
           self.data['image'] = "pix/{0}.jpg".format(arg[7])
        if os.path.isfile("video/{0}.webm".format(arg[7])):
           self.data['video'] = "video/{0}.webm".format(arg[7])
        if os.path.isfile("video/{0}_expl.webm".format(arg[7])):
            self.data['explanation'] = {
                'video': "video/{0}_expl.webm".format(arg[7])}

    def get_points(self):
        """docstring for get_points"""
        for key in sorted(self.points.keys()):
            yield self.points[key]

def extract_data(questions):
    """docstring for write_json"""
    #return [json.dumps(question.data, sort_keys=True, indent=2) + ',\n' for question in questions]
    return [question.data for question in questions]

def main():
    csv_fh = csv.reader(open("questions.txt", "rb"), delimiter=';', quotechar="'")
    questions = []
    round = 0
    for entry in csv_fh:
        if len(entry[0]):
            questions.append(Question(entry))
        else:
            fh = open('round_%s.json'% (round), 'w')
            fh.writelines(json.dumps(extract_data(questions), indent=2))
            for q in extract_data(questions):
                answers = ["<ol>\n",]
                for answer in q['answers']:
                    if answer.has_key('right'):
                        answers.extend([
                            "<li><b>", answer.get('text'), "</b></li>\n"]
                        )
                    else:
                        answers.extend(["<li>", answer.get('text'), "</li>\n"])
                answers.append("\n</ol>\n")
                answers.append("<mbp:pagebreak />\n")
            questions = []
            round += 1

if __name__ == '__main__':
    main()
