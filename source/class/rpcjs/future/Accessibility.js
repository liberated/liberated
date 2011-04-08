/*
 * Copyright:
 *   2011 Derrell Lipman
 *
 * License:
 *   LGPL: http://www.gnu.org/licenses/lgpl.html
 *   EPL: http://www.eclipse.org/org/documents/epl-v10.php
 *   See the LICENSE file in the project's top-level directory for details.
 *
 * Authors:
 *   * Derrell Lipman (derrell)
 */

/*
#asset(rpcjs/*)
*/

/**
 * Accessibility constants
 */
qx.Class.define("rpcjs.future.Accessibility",
{
  extend : qx.core.Object,

  /**
   * Method Accessibility values
   */
  statics :
  {
    /**
     * Public -
     *   The method may be called from any session, and without any checking
     *   of who the Referer is.
     */
    Public  : "public",

    /**
     * Domain -
     *   The method may only be called by a script obtained via a web page
     *   loaded from this server.  The Referer must match the request URI,
     *   through the domain part.
     */
    Domain  : "domain",

    /**
     * Session -
     *   The Referer must match the Referer of the very first RPC request
     *   issued during the session.
     */
    Session : "session",

    /**
     * Fail -
     *   Access is denied
     */
    Fail    : "fail"
  }
});
