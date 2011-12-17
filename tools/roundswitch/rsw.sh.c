#!/usr/bin/tcc -run
/*
 * 
 * ============================================================================
 *
 *       Filename:  rsw.sh.c
 *
 *    Description:  
 *
 *        Version:  1.0
 *        Created:  14.12.2011 01:31:04
 *       Revision:  none
 *
 *         Author:  john@tuxcode.org
 *        Company:  tuxcode.org
 *
 * ============================================================================
 */

#include <stdio.h>
#include <limits.h>
#include <stdlib.h>
#include <errno.h>
#include <unistd.h>


#define DATAPATH "/home/john/tuxgit/pentagameshow/data/"
#define ROUNDFOMAT DATAPATH "round_%d.json"
#define ACTIROUND DATAPATH "questions.json"



static void usage(){
	puts(
			"bitte gib die rundennummer as einzigeb aufrufparameter ein\n"
			"die rundennummer ist eine Natürliche Zahl in ascii Darstellung\n"
			"zwischen 1 und 5 \n"
	    );
	exit(1);
}




int
main ( int argc, char *argv[] )
{
	long int i;
	char *eptr;
	char act[128];
	if (argc != 2)
		usage();
	errno = 0;
	i = strtol(argv[1],&eptr,0);
	


	if ((errno == ERANGE && (i == LONG_MAX || i == LONG_MIN))
			|| (errno != 0 && i == 0)) {
		perror("strtol");
		exit(EXIT_FAILURE);
	}

	if (eptr == argv[1]) {
		fprintf(stderr, "No digits were found\n");
		exit(EXIT_FAILURE);
	}
	
	if ((i <1) || (i>5)){
		fprintf(stderr, "Round Number out of Range (1-5)\n");
		exit(EXIT_FAILURE);
	}

	if (remove(ACTIROUND)){
		fprintf(stderr, "Unable to remove old stufffz\n");
	}

	if (  6 > snprintf(act,128,ROUNDFOMAT,i)) {
		fprintf(stderr, "wudurudu\n");
		exit(EXIT_FAILURE);
	}

       symlink(act,ACTIROUND);
	return 0;
}				/* ----------  end of function main  ---------- */
