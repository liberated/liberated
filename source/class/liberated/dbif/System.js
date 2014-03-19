/**
 * Copyright (c) 2014 Derrell Lipman
 * 
 * License:
 *   LGPL: http://www.gnu.org/licenses/lgpl.html 
 *   EPL : http://www.eclipse.org/org/documents/epl-v10.php
 */

qx.Class.define("liberated.dbif.System",
{
  statics :
  {
    /**
     * Register the environment-specific set of System functions. After
     * completion of this function, it will no longer be available because
     * our own class name will be replaced with the environment-specific
     * class.
     *
     * @param clazz {qx.core.Object}
     *   The class which will provide all system facilities.
     */
    registerSystemProvider : function(clazz)
    {
      // Obviate this entire class by replacing ourself with the specified class
      liberated.dbif.System = clazz;
    }
  }
});
