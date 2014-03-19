/**
 * Copyright (c) 2014 Derrell Lipman
 * 
 * License:
 *   LGPL: http://www.gnu.org/licenses/lgpl.html 
 *   EPL : http://www.eclipse.org/org/documents/epl-v10.php
 */

/***********************************************************************
 *
 *                        THIS IS UNTESTED CODE !!!
 *
 ***********************************************************************/

qx.Class.define("liberated.node.SqliteDbif",
{
  extend  : qx.core.Object,

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
     */
    readFile : function(filename, options)
    {
      var             line;
      var             reader;
      var             stringBuilder;
      var             FileReader = java.io.FileReader;
      var             BufferedReader = java.io.BufferedReader;
      var             StringBuilder = java.lang.StringBuilder;

      // If no options were specified...
      if (! options)
      {
        // ... then create an empty options map
        options = {};
      }

      // Set default options
      options.encoding = options.encoding || "utf8";

      // Open the file for reading.
      reader = new BufferedReader(new FileReader(filename));

      // Prepare to enqueue each line of the file
      stringBuilder = new StringBuilder();

      // Read the first line
      if ((line = reader.readLine()) != null)
      {
        stringBuilder.append(line);
      }

      // Read subsequent lines, prepending a newline to each
      while ((line = reader.readLine()) != null)
      {
        stringBuilder.append("\n");
        stringBuilder.append(line);
      }

      // Give 'em the file data!
      return String(stringBuilder.toString());
    },


    /**
     * Write data to a file
     *
     * @param filename {String}
n       *   The name of the file to be written to
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
     */
    writeFile : function(filename, data, options)
    {
      var             writer;
      var             PrintWriter = java.io.PrintWriter;

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
      writer = new PrintWriter(filename, options.encoding);
      writer.print(data);
      writer.close();
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
     */
    fileExists : function(filename)
    {
      var             file;
      var             File = java.io.File;

      // Determine if the file exist!
      file = new File(filename);
      return file.exists();
    },


    /**
     * Rename a file. If the destination name exists, the results are
     * undefined
     *
     * @param oldName {String}
     *   The existing name of the file.
     *
     * @param newName {String}
     *   The name to move the file to.
     *
     * @return {Boolean}
     *   true if the file was renamed; false otherwise
     */
    rename : function(oldName, newName)
    {
      var             fileOld;
      var             fileNew;
      var             File = java.io.File;

      // Rename the file!
      fileOld = new File(oldName);
      fileNew = new File(newName);
      return fileOld.rename(fileNew);
    },


    /**
     * Read a directory and retrieve its constituent files/directories
     *
     * @param directory
     *   The name of the directory to be read
     *
     * @return {Array|null}
     *   If the specified directory name exists and is a directory, the
     *   returned array will be the list of files and directories found
     *   therein. Otherwise, null is returned.
     */
    readdir : function(directory)
    {
      var             dir;
      var             files;
      var             File = java.io.File;

      // Open the directory
      dir = new File(dirData.name);

      // Obtain its files (if any)
      files = dir.listFiles();

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
     */
    system : function(cmd, options)
    {
      var             line;
      var             reader;
      var             dirFile;
      var             process;
      var             runtime;
      var             retval;
      var             stringBuilder;
      var             File = java.io.File;
      var             BufferedReader = java.io.BufferedReader;
      var             InputStreamReader = java.io.InputStreamReader;
      var             StringBuilder = java.lang.StringBuilder;
      var             Runtime = java.lang.Runtime;

      // If no options were specified...
      if (! options)
      {
        // ... then create an empty options map
        options = {};
      }

      // Prepare to exec processes
      runtime = Runtime.getRuntime();

      // Get a handle to the specified directory
      if (options.cwd)
      {
        dirFile = new File(options.cwd);
      }
      else
      {
        dirFile = null;
      }

      // Execute the command and wait for it to complete
      process = runtime.exec(cmd, null, dirFile);
      process.waitFor();

      // Initialize the return map. stdout and stderr will be added later.
      retval =
        {
          exitCode : process.exitValue()
        }

      //
      // Get any output to stdout and stderr
      //
      [
        { stream : process.getInputStream(), return_field : "stdout" },
        { stream : process.getErrorStream(), return_field : "stderr" }
      ].forEach(
        function(streamInfo)
        {
          // Prepare to retrieve data from this stream
          reader = new BufferedReader(new InputStreamReader(streamInfo.stream));

          // Prepare to enqueue each line of the output on the stream
          stringBuilder = new StringBuilder();

          // Read the first line
          if ((line = reader.readLine()) != null)
          {
            stringBuilder.append(line);
          }

          // Read subsequent lines, prepending a newline to each
          while ((line = reader.readLine()) != null)
          {
            stringBuilder.append("\n");
            stringBuilder.append(line);
          }

          // Give 'em the output on this stream
          retval[streamInfo.return_field] = String(stringBuilder.toString());
        });

      // Return a map with exitCode and, if exitCode != 0, stdout and stderr
      return retval;
    }
  }
});
