/**
 * Copyright (c) 2011 Derrell Lipman
 * 
 * License:
 *   LGPL: http://www.gnu.org/licenses/lgpl.html 
 *   EPL : http://www.eclipse.org/org/documents/epl-v10.php
 */

/*
#use(jettysqlite.ObjCounter)
*/

qx.Class.define("jettysqlite.Services",
{
  extend : qx.core.Object,

  include :
  [
    jettysqlite.MQooxdoo,
    jettysqlite.MCounter
  ],

  construct : function(rpc)
  {
    this.base(arguments);
    
    // Save the remote procedure call instance
    this.__rpc = rpc;
  },

  members :
  {
    __rpc : null,

    /**
     * Register a service name and function.
     *
     * @param serviceName {String}
     *   The name of this service within the <[rpcKey]> namespace.
     *
     * @param fService {Function}
     *   The function which implements the given service name.
     * 
     * @param paramNames {Array}
     *   The names of the formal parameters, in order.
     */
    registerService : function(serviceName, fService, paramNames)
    {
      // Register with the RPC provider
      this.__rpc.registerService(serviceName, fService, this, paramNames);
    }
  }
});
