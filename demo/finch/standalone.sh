#!/bin/bash

java -Djava.library.path=. -classpath 'jars/*' org.mozilla.javascript.tools.shell.Main $*

