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
 * Mixin to add simulator functionality to qx.io.remote.Exchange.
 */
qx.Mixin.define("rpcjs.sim.remote.MRequest",
{
  properties :
  {
    /** Whether to simulate transport using rpcjs.sim.rpc.Simulator */
    simulate :
    {
      check    : "Boolean",
      nullable : false,
      init     : false
    }
  }
});

