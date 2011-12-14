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
#asset(liberated/*)
*/


/**
 * Mixin to add simulator functionality to qx.io.remote.Exchange.
 */
qx.Mixin.define("liberated.sim.remote.MRequest",
{
  properties :
  {
    /** Whether to simulate transport using liberated.sim.rpc.Simulator */
    simulate :
    {
      check    : "Boolean",
      nullable : false,
      init     : false
    }
  }
});

