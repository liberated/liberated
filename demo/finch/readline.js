load("build/script/qxlib-noopt.js");
importPackage(java.io);
importPackage(java.lang);

qx.Class.define("StdIn",
{
  extend : qx.core.Object,
  
  statics :
  {
    fd : new BufferedReader(new InputStreamReader(System['in'])),

    readline : function()
    {
      return StdIn.fd.readLine();
    },
    
    isInputAvailable : function()
    {
      return StdIn.fd.ready();
    }
  }
});


