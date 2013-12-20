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
@asset(liberated/*)
*/

/**
 * Origin constants
 */
qx.Class.define("liberated.rpc.error.Error",
{
  extend : qx.core.Object,
  
  construct : function(protocolId)
  {
    // Call the superclass constructor
    this.base(arguments);
    
    // Save the protocol id
    this.setProtocol(protocolId || "2.0");
  },

  properties :
  {
    /**
     * The version of the JSON-RPC protocol to use.  The default is the latest
     * version of the protocol, currently "2.0".
     */
    protocol :
    {
      init     : "2.0",
      nullable : false,         // server knows the protocol by now.
      check    : function(protocolId)
      {
        return [ "2.0" ].indexOf(protocolId) != -1;
      }
    },

    /**
     * The error code. If the origin is Server, then this value must be one of
     * the values of qx.io.remote.RpcError.qx1.error.server.*
     */
    code :
    {
      check   : "Integer",
      init    : qx.io.remote.RpcError.v2.error.InvalidRequest
    },
    
    /**
     * A descriptive message for the error.
     */
    message :
    {
      check   : "String",
      init    : "Unspecified error"
    },
    
    /**
     * A primitive or structured value that contains additional information
     * about the error. It is optional. This is used only for protocol "2.0".
     */
    data :
    {
      init     : null,
      nullable : true
    }
  },
  
  members :
  {
    stringify : function()
    {
      var             data;
      var             error;

      // Create an object which will contain the appropriate members
      error = { };
      
      // We stringify differently depending on the protocol
      switch(this.getProtocol())
      {
      case "2.0":
        error.code = this.getCode();
        error.message = this.getMessage();
        
        // See if there's any data
        data = this.getData();
        if (data !== null)
        {
          // There is, so return it.
          error.data = data;
        }
        break;
        
      default:
        throw new Error("Unrecognized RPC Error protocol version");
      }
      
      // Format the error object into a JSON response
      return qx.lang.Json.stringify(error);
    }
  }
});
