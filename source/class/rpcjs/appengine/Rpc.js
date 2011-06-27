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
 * Handler for remote procedure calls.
 */
qx.Class.define("rpcjs.appengine.Rpc",
{
  extend : rpcjs.AbstractRpcHandler,

  construct : function(services, url)
  {
    // Call the superclass constructor
    this.base(arguments, services);

    // The url is ignored in this implementation. We only get here if the url
    // matches what's specified in web.xml.
  },
  
  members :
  {
    /**
     * Process an incoming request which is presumably a JSON-RPC request.
     * 
     * @param jsonData {String}
     *   The data provide in a POST request
     * 
     * @return {String}
     *   Upon success, the JSON-encoded result of the RPC request is returned.
     *   Otherwise, null is returned.
     */
    processRequest : function(jsonData)
    {
      // Call the RPC server to process this request
      return this._rpcServer.processRequest(jsonData);
    }
  }
});
