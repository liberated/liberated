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
 * Mixin to add simulator functionality to qx.io.remote.Rpc.
 */
qx.Mixin.define("rpcjs.sim.remote.MRpc",
{
  statics :
  {
    // Whether to request the simulator
    SIMULATE : true
  },

  members :
  {
    createRequest: function()
    {
      // Get a remote request object
      var request = new qx.io.remote.Request(this.getUrl(),
                                             "POST",
                                             "application/json");

      // Have we been requested to use the simulator?
      if (rpcjs.sim.remote.MRpc.SIMULATE)
      {
        // Yup. Make the request
        request.setSimulate(true);
      }
      
      return request;
    }
  }
});

