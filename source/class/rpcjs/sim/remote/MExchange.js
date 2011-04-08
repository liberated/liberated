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
#require(qx.io.remote.Exchange)
*/


/**
 * Mixin to add simulator functionality to qx.io.remote.Exchange.
 */
qx.Mixin.define("rpcjs.sim.remote.MExchange",
{
  members :
  {
    /**
     * Sends the request. Adds 'simulate' need test.
     *
     * @return {var|Boolean} 
     *   Returns true if the request was sent.
     */
    send : function()
    {
      var             transportImpl;
      var             transport;
      var              request;
      
      // Get the current request object.
      request = this.getRequest();
      if (!request) 
      {
        return this.error("Please attach a request object first");
      }

      qx.io.remote.Exchange.initTypes();

      var usage = qx.io.remote.Exchange.typesOrder;
      var supported = qx.io.remote.Exchange.typesSupported;

      // Mapping settings to contenttype and needs to check later
      // if the selected transport implementation can handle
      // fulfill these requirements.
      var responseType = request.getResponseType();
      var needs = {};

      if (request.getAsynchronous()) 
      {
        needs.asynchronous = true;
      }
      else
      {
        needs.synchronous = true;
      }

      if (request.getCrossDomain()) 
      {
        needs.crossDomain = true;
      }

      if (request.getFileUpload()) 
      {
        needs.fileUpload = true;
      }

      // See if there are any programtic form fields requested
      for (var field in request.getFormFields())
      {
        // There are.
        needs.programaticFormFields = true;

        // No need to search further
        break;
      }

      // See if we're asked to simulate the transport
      if (request.getSimulate())
      {
        needs.simulate = true;
      }

      for (var i=0, l=usage.length; i<l; i++)
      {
        transportImpl = supported[usage[i]];

        if (transportImpl)
        {
          if (!qx.io.remote.Exchange.canHandle(transportImpl, needs,
                                               responseType, request)) {
            continue;
          }

          try
          {
            if (qx.core.Environment.get("qx.debug"))
            {
              if (qx.core.Environment.get("qx.ioRemoteDebug")) {
                this.debug("Using implementation: " + transportImpl.classname);
              }
            }

            transport = new transportImpl;
            this.setImplementation(transport);

            transport.setUseBasicHttpAuth(request.getUseBasicHttpAuth());

            transport.send();
            return true;
          }
          catch(ex)
          {
            this.error("Request handler throws error");
            this.error(ex);
            return false;
          }
        }
      }

      this.error("There is no transport implementation available " +
                 "to handle this request: " + request);
      return false;
    }
  },


  defer :
  {
  }
});

