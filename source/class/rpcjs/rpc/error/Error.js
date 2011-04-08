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
 * Origin constants
 */
qx.Class.define("rpcjs.rpc.error.Error",
{
  extend : qx.core.Object,
  
  construct : function(protocolId)
  {
    // Call the superclass constructor
    this.base(arguments);
    
    // Save the protocol id
    this.setProtocol(protocolId);
  },

  properties :
  {
    /**
     * The version of the JSON-RPC protocol to use.  If null, the protocol is
     * auto-identified from the request. Otherwise, the strings "qx1"
     * (qooxdoo's modified Version 1) and "2.0" are currently allowed.
     *
     * @note
     *   At this time, only qooxdoo's modified version 1 ("qx1") is supported.
     */
    protocol :
    {
      check    : "String",
      init     : "qx1",
      nullable : false,         // server knows the protocol by now.
      check    : function(protocolId)
      {
        return [ "qx1", "2.0" ].indexOf(protocolId) != -1;
      }
    },

    /**
     * The origin of the error. Its value must be one of the values of
     * rpcjs.rpc.error.Origin. This is used only for protocol "qx1"
     */
    origin :
    {
      check   : "Integer",
      init    : rpcjs.rpc.error.Origin.Server
    },
    
    /**
     * The error code. If the origin is Server, then this value must be one of
     * the values of rpcjs.rpc.error.ServerCode.
     */
    code :
    {
      check   : "Integer",
      init    : rpcjs.rpc.error.ServerCode.qx1.Unknown
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
          error.data = this.getData();
        }
        break;
        
      case "qx1":
        error.origin = this.getOrigin();
        error.code = this.getCode();
        error.message = this.getMessage();
        break;
      }
      
      // Format the error object into a JSON response
      return qx.lang.Json.stringify(error);
    }
  }
});
