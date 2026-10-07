/* Decode the user's transparent sheets at runtime, with a shared foot anchor. */
(function (host) {
  'use strict';
  var sheets = [
    {name:'front',file:'front-portrait.png',cuts:[0,1205],eyes:[[.425,.207,.054,.043],[.591,.207,.045,.043]]},
    {name:'directions',file:'look-directions.png',cuts:[0,515,1030,1544,2059],views:['up','right','down','left']},
    {name:'left',file:'look-left-strip.png',cuts:[0,274,545,812,1076,1334,1598,1866,2172],views:['down','left','left','left','left','left','left','up']},
    {name:'right',file:'look-right-strip.png',cuts:[0,268,541,813,1084,1356,1627,1900,2172],views:['up','right','right','right','right','right','right','right']},
    {name:'blink',file:'blink-strip.png',cuts:[0,362,724,1086,1448,1810,2172],eyes:[[.385,.285,.065,.034],[.681,.286,.065,.034]]}
  ];
  function bounds(pixels, width, height) {
    var count=width*height, seen=new Uint8Array(count), queue=new Uint32Array(count);
    var largest=0, box=null;
    // Measure the largest connected opaque figure, excluding neighbouring hands and specks.
    for(var start=0;start<count;start++) {
      if(seen[start] || pixels[start*4+3]<=128)continue;
      var head=0,tail=1,left=width,right=0,top=height,bottom=0;
      queue[0]=start;seen[start]=1;
      while(head<tail) {
        var at=queue[head++],x=at%width,y=Math.floor(at/width);
        left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
        var neighbours=[x>0?at-1:-1,x+1<width?at+1:-1,y>0?at-width:-1,y+1<height?at+width:-1];
        for(var n=0;n<4;n++) {
          var next=neighbours[n];
          if(next>=0&&!seen[next]&&pixels[next*4+3]>128){seen[next]=1;queue[tail++]=next;}
        }
      }
      if(tail>largest){largest=tail;box={x:left,y:top,width:right-left+1,height:bottom-top+1};}
    }
    return largest<16?null:box;
  }

  function layout(box) {
    var scale=Math.min(600/box.height,360/box.width);
    return {scale:scale,x:(400-box.width*scale)/2,y:680-box.height*scale};
  }
  function order(kind) {
    // Out, pause, then retrace the same frames; never wrap the last head pose to the first.
    if(kind==='left')return [0,1,2,3,4,4,3,2,1,0];
    if(kind==='right')return [0,1,2,3,4,5,5,4,3,2,1,0];
    return [0,1,2,3,4,5];
  }
  async function load(register) {
    var result={};
    await Promise.all(sheets.map(async function(sheet){
      try {
        var image=await new Promise(function(resolve,reject){var img=new Image();img.onload=function(){resolve(img);};img.onerror=reject;img.src='./assets/thoth/'+sheet.file;});
        var frames=[];
        for(var i=0;i<sheet.cuts.length-1;i++) {
          var w=sheet.cuts[i+1]-sheet.cuts[i],h=image.naturalHeight;
          var crop=document.createElement('canvas');crop.width=w;crop.height=h;
          var ctx=crop.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,sheet.cuts[i],0,w,h,0,0,w,h);
          var box=bounds(ctx.getImageData(0,0,w,h).data,w,h);if(!box)throw new Error('Empty pet frame');
          var pos=layout(box),canvas=document.createElement('canvas');canvas.width=400;canvas.height=724;
          canvas.getContext('2d').drawImage(crop,box.x,box.y,box.width,box.height,pos.x,pos.y,box.width*pos.scale,box.height*pos.scale);
          var src=canvas.toDataURL('image/png'),view=sheet.views && sheet.views[i];
          var eyes=(sheet.eyes||[]).map(function(e){return [(pos.x+(e[0]*w-box.x)*pos.scale)/400,(pos.y+(e[1]*h-box.y)*pos.scale)/724,e[2]*w*pos.scale/400,e[3]*h*pos.scale/724];});
          register(src,{side:view==='left'||view==='right',nativeFacing:view==='left'?'left':'right',closed:!eyes.length||sheet.name==='blink'&&(i===2||i===3),eyes:eyes,pose:view||sheet.name});
          frames.push(src);
        }
        result[sheet.name]=frames;
      } catch (_) { /* Other sheets and the original poses remain usable if one fails. */ }
    }));
    return result;
  }
  var api={load:load,bounds:bounds,layout:layout,order:order};
  if(host)host.ThothArtwork=api;else if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:null);
