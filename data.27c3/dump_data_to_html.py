#!/usr/bin/env python

# -*- coding: utf-8 -*-

"""
Dump the Pentasubmitter data via Django ORM to intermediate csv format
"""

__author__ = "Frank Becker <fb@alien8.de>"
__version__ = "$Revision: 0.0 $"
__date__ = "$Date: YDATE $"
__copyright__ = "Copyright (c) 2010 Frank Becker"
__license__ = "Python"

import unicodedata
from submitter import models

def main():
    """docstring for main"""
    news_entries = models.NewsEntry.objects.all()
    fh = open('/tmp/pm.html', 'w')
    for ne in news_entries:
        #fh.write(u'http://pentamedia.c3d2.de'+ne.get_absolute_url() + u'">'+ne.title.encode('utf-8', 'ignore')+u'</a>\n')
        title = unicodedata.normalize('NFKD', ne.title).encode('ascii', 'ignore')
        print title
        fh.write(
            u'http://pentamedia.c3d2.de' + \
            ne.get_absolute_url().encode('utf-8') + \
            u'">'+ \
            title + \
            u'</a>\n')

if __name__ == '__main__':
    main()

# vim: tabstop=4 expandtab shiftwidth=4 softtabstop=4 fileencoding=utf-8 :

