/**
 * Copyright (c) 2014 Derrell Lipman
 * 
 * License:
 *   LGPL: http://www.gnu.org/licenses/lgpl.html 
 *   EPL : http://www.eclipse.org/org/documents/epl-v10.php
 */

qx.Class.define("liberated.node.System",
{
  extend    : qx.core.Object,

  statics :
  {
    /**
     * Read a file and return its data
     *
     * @param filename {String}
     *   The full or relative path to the file.
     *
     * @param options {Map?}
     *   Options for reading from the file. The available options are:
     *
     *     encoding - The data is read as/converted to the specified
     *                encoding (defaults to "utf8")
     *
     * @return {String}
     *   The data read from the file.
     * 
     * @ignore(require)
     */
    readFile : function(filename, options)
    {
      var             fs = require("fs");
      var             sync = require("synchronize");
      var             retval;

      // If no options were specified...
      if (! options)
      {
        // ... then create an empty options map
        options = {};
      }

      // Set default options
      options.encoding = options.encoding || "utf8";

      // Read the file data
      retval = sync.await(fs.readFile(filename, options, sync.defer()));
      
      // Convert it from "buffer" format into a string
      retval = retval.toString();
      
      // Give it to 'em!
      return retval;
    },


    /**
     * Write data to a file
     *
     * @param filename {String}
     *   The name of the file to be written to
     *
     * @param data {String}
     *   The data to be written to the file
     *
     * @param options {Map?}
     *   A map of options, any of which may be omitted:
     *
     *     encoding {String}
     *       The encoding to use writing to the file. (default: "utf8")
     *
     *     mode {Number}
     *       The file creation mode. (default: 0666)
     *
     *     flag {String}
     *       The method of writing to the file, "w" to truncate then write;
     *       "a" to append. (default: "w")
     * 
     * @ignore(require)
     */
    writeFile : function(filename, data, options)
    {
      var             fs = require("fs");
      var             sync = require("synchronize");

      // If no options were specified...
      if (! options)
      {
        // ... then create an empty options map
        options = {};
      }

      // Set default options
      options.encoding = options.encoding || "utf8";
      options.mode = options.mode || 0666;
      options.flag = options.flag || "w";

      // Write the file data!
      sync.await(fs.writeFile(filename, data, options, sync.defer()));
    },


    /**
     * Determine if a file exists.
     *
     * @param filename {String}
     *   The name of the file (full or relative path) whose existence is to
     *   be ascertained.
     *
     * @return {Boolean}
     *   true if the file exists; false otherwise.
     *
     * @ignore(require)
     */
    fileExists : function(filename)
    {
      var             fs = require("fs");
      var             sync = require("synchronize");

      // Determine if the file exist!
      return sync.await(fs.exists(filename, sync.defer()));
    },


    /**
     * Rename a file.
     *
     * @param oldName {String}
     *   The existing name of the file.
     *
     * @param newName {String}
     *   The name to move the file to.
     * 
     * @ignore(require)
     */
    rename : function(oldName, newName)
    {
      var             fs = require("fs");
      var             sync = require("synchronize");

      // Rename the file!
      try
      {
        console.log("Rename '" + oldName + "' to '" + newName + "'");
        sync.await(fs.rename(oldName, newName, sync.defer()));
        return true;
      }
      catch(e)
      {
        console.log("rename: " + e);
        return false;
      }
    },


    /**
     * Read a directory and retrieve its constituent files/directories
     *
     * @param directory {String}
     *   The name of the directory to be read
     *
     * @return {Array|null}
     *   If the specified directory name exists and is a directory, the
     *   returned array will be the list of files and directories found
     *   therein. Otherwise, null is returned.
     * 
     * @ignore(require)
     */
    readdir : function(directory)
    {
      var             files;
      var             fs = require("fs");
      var             sync = require("synchronize");

      try
      {
        files = sync.await(fs.readdir(directory, sync.defer()));
      }
      catch(e)
      {
        // We couldn't read the directory. It may not exists; it may be a
        // file, not a directory; or some other error may have occurred.
        console.log("readdir: " + e);
        return null;
      }

      // Give 'em the files list
      return files;
    },


    /**
     * Execute a system command.
     *
     * @param cmd {Array}
     *   The command to be executed, as an array of the individual
     *   arguments, a la "argv"
     *
     * @param options {Map?}
     *   A map of options, any of which may be excluded. The options are:
     *
     *     cwd {String}
     *       The directory in which the command should be executed
     *
     * @return {Map}
     *   The returned map has three members:
     *
     *     exitCode {Number}
     *       0 upon successful termination of the specified command;
     *       non-zero othersise.
     *
     *     stdout {String}
     *       The standard output of the program. This may be undefined or
     *       null if exitCode was non-zero
     *
     *     stderr {String}
     *       The standard error output of the program. This may be undefined
     *       or null if exitCode was non-zero.
     *
     * @ignore(require)
     * @ignore(sync.await)
     * @ignore(sync.defer)
     */
    system : function(cmd, options)
    {
      var             retval;
      var             localOptions = {};
      var             exec = require("child_process").exec;
      var             sync = require("synchronize");

      // Create a function in the standard async format
      function doExec(cmd, options, callback)
      {
        var             child;

        child = exec(
          cmd,
          options,
          function(err, stdout, stderr)
          {
            callback(null, 
                     {
                       exitCode : err == null ? 0 : err.code,
                       stdout   : stdout,
                       stderr   : stderr
                     });
          });
      }

      // If no options were specified...
      if (! options)
      {
        // ... then create an empty options map
        options = {};
      }

      // Convert the command from array to quoted strings
      cmd =
        cmd.map(
          function(arg)
          {
            return "'" + arg.replace("'", "\\'") + "'";
          }).join(" ");

      console.log("System.system: cmd=" + JSON.stringify(cmd) + 
                  ", options=" + JSON.stringify(options));

      // Set default local options
      localOptions.showStderr = true;

      // Save the local options, and strip them from the options map to be
      // passed to exec
      [
        "showStdout"
      ].forEach(
        function(opt)
        {
          localOptions[opt] = options[opt];
          delete options[opt];
        });

      // Run the command
      retval = sync.await(doExec(cmd, options, sync.defer()));
      console.log("(system() command exit code: " + retval.exitCode + ")");

      // If we were asked to display stdout...
      if (localOptions.showStdout && retval.stdout.toString().length > 0)
      {
        console.log("STDOUT: " + retval.stdout);
      }

      if (localOptions.showStderr && retval.stderr.toString().length > 0)
      {
        console.log("STDERR: " + retval.stderr);
      }

      // Return the map with exitCode and, if exitCode != 0, stdout and stderr
      return retval;
    }
  }
});
