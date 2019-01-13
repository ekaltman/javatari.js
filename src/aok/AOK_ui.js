//Just adding a general asset function
//if we need more utils I'll create a separate file
function assert(condition, message){
    if(!condition){
	throw new Error(message);
    }
}



//component to manage UI functions of emulator
//and receive information from AOK
jt.aokUI= function(uiElement, atariConsole){

    //hook up aok instance
    var aok = atariConsole.retrieveAOK();

    //setup ui elements
    var editorElement = document.createElement("div");
    editorElement.setAttribute("id", "ui-editor");

    var loadCodeButton = document.createElement("button");
    var loadCodeButtonTextNode = document.createTextNode("Load Editor Code");
    loadCodeButton.setAttribute("id", "ui-run-code-button");
    loadCodeButton.appendChild(loadCodeButtonTextNode);

    var standardOutput = document.createElement("div");
    standardOutput.setAttribute("id", "ui-standard-output");
    standardOutput.style.fontFamily = "courier";

    //tab interface setup
    //based on: https://www.w3schools.com/howto/howto_js_tabs.asp

    var tabHolder = document.createElement("div");
    var codeTab = document.createElement("div");
    var sheetTab = document.createElement("div");
    var visTab = document.createElement("div");
    var codeTabButton = document.createElement("button");
    var sheetTabButton = document.createElement("button");
    var visTabButton = document.createElement("button");


    tabHolder.style.height = "16px";

    codeTab.setAttribute("id", "aok-ui-codetab");
    sheetTab.setAttribute("id", "aok-ui-sheettab");
    visTab.setAttribute("id", "aok-ui-vistab");
    sheetTab.innerHTML = "Sheet Vis Goes Here";

    codeTab.className = "aok-ui-tabcontent";
    sheetTab.className = "aok-ui-tabcontent";
    visTab.className = "aok-ui-tabcontent";

    codeTabButton.className = "aok-ui-tablinks";
    sheetTabButton.className = "aok-ui-tablinks";
    visTabButton.className = "aok-ui-tablinks";

    codeTabButton.addEventListener("click", function(e){ openTab(e, "aok-ui-codetab"); });
    sheetTabButton.addEventListener("click", function(e){ openTab(e, "aok-ui-sheettab");});
    visTabButton.addEventListener("click", function(e){ openTab(e, "aok-ui-vistab");});

    codeTabButton.innerHTML = "Code";
    sheetTabButton.innerHTML = "Sheet";
    visTabButton.innerHTML = "Vis";


    //Tab Controls

    function openTab(event, tabname){
	var i, tabcontent, tablinks;

	tabcontent = document.getElementsByClassName("aok-ui-tabcontent");
	for(i = 0; i < tabcontent.length; i++){
	    tabcontent[i].style.display = "none";
	}

	tablinks = document.getElementsByClassName("aok-ui-tablinks");
	for(i = 0; i < tablinks.length; i++){
	    tablinks[i].className = tablinks[i].className.replace(" active", "");
	}

	document.getElementById(tabname).style.display = "block";
	event.currentTarget.className += " active";
    }

    // Just load the current code for now
    loadCodeButton.addEventListener("click", function(){
	aok.newfile(editor.getValue());
    });

    var hasFileSelector = false;
    // Currently setting up file loader to have only one file at a time
    if (window.File && window.FileReader && window.FileList && window.Blob){
	var fileSelector = document.createElement("input");
	hasFileSelector = true;
	fileSelector.setAttribute("type", "file");
	fileSelector.setAttribute("id", "ui-file-input");
	fileSelector.addEventListener("change", readFile, false);


	function readFile(event){
	    var file = event.target.files[0];

	    if (!file){
		console.log("Failed to load selected file.");
	    }else{
		var r = new FileReader();
		r.onload = function(e) {
		    var textContents = e.target.result;
		    editor.setValue(textContents);
		};
		r.readAsText(file);
	    }
	}

    }

    //Memory Visualization Component
    var memVisHolder = document.createElement("div");
    var memVisGridWidth = 16;
    var memVisGridHeight = 8;
    var memVisGridSquarePxSize = 40;
    var memVisGridSourceArray = randomNoise(memVisGridWidth, memVisGridHeight);
    var memVisGridElementArray = [];

    memVisHolder.style.borderStyle = "solid";
    memVisHolder.style.borderWidth= "thin";
    memVisHolder.style.width = memVisGridSquarePxSize * memVisGridWidth + "px";
    memVisHolder.style.height = memVisGridSquarePxSize * memVisGridHeight + "px";
    memVisHolder.style.position = "relative";


    function randomNoise(w, h){
	var gridValues = [];
	for (var i = 0; i < w * h; i++){
	    gridValues.push(Math.random());
	}
	return gridValues;
    }

    function grayScaleFloatNumberMapColor(value){
	var color = "#";
	var scaledValue = Math.floor(value * 255).toString(16);
	if (scaledValue < 10){
	    scaledValue = "0" + scaledValue;
	}
	return color + scaledValue + scaledValue + scaledValue;
    }

    function grayScaleFloatNumberMapColor(value){
	var color = "#";
	var scaledValue = Math.floor(value * 255).toString(16);
	if (scaledValue < 10){
	    scaledValue = "0" + scaledValue;
	}
	return color + scaledValue + scaledValue + scaledValue;
    }

    var i;
    for (i = 0; i < memVisGridSourceArray.length; i++){
	memVisGridSourceArray[i] = grayScaleNumberMapColor(memVisGridSourceArray[i]);
	var element = document.createElement('div');
	element.style.backgroundColor = memVisGridSourceArray[i];
	element.style.height = memVisGridSquarePxSize + "px";
	element.style.width = memVisGridSquarePxSize + "px";
	element.style.position = "absolute";

	var left = (i % memVisGridWidth) *  memVisGridSquarePxSize;
	element.style.left = "" + left + "px";

	var topValue = Math.floor(i / memVisGridWidth) *  memVisGridSquarePxSize;
	element.style.top = "" + topValue + "px";
	element.style.textAlign = "center";
	element.style.verticalAlign = "middle";
	element.style.fontFamily = "courier";

	memVisGridElementArray.push(element);

	memVisHolder.appendChild(element);
    }

    function applyNewGrayScaleColorMap(elementArray, values){
	assert(elementArray.length === values.length, "Element array and values array do not match");
	for (var i = 0; i < elementArray.length; i++){
	    elementArray[i].style.backgroundColor = grayScaleNumberMapColor(values[i]);
	}
    }

    function applyNewTextValuesMap(elementArray, values){
	assert(elementArray.length === values.length, "Element array and values array do not match");
	for (var i = 0; i < elementArray.length; i++){
	    elementArray[i].innerHTML = values[i].toString(16);
	    elementArray[i].style.backgroundColor = grayScaleNumberMapColor(values[i]);
	}
    }


    // Attach UI Elements
    uiElement.appendChild(tabHolder);
    tabHolder.appendChild(codeTabButton);
    tabHolder.appendChild(sheetTabButton);
    tabHolder.appendChild(visTabButton);

    uiElement.appendChild(codeTab);
    codeTab.appendChild(editorElement);
    codeTab.appendChild(loadCodeButton);
    if(hasFileSelector){
	codeTab.appendChild(fileSelector);
    }

    uiElement.appendChild(sheetTab);
    uiElement.appendChild(visTab);
    visTab.appendChild(memVisHolder);

    uiElement.appendChild(standardOutput);
    //Default Code tab is selected

    codeTab.style.display = "block";

    var editor = CodeMirror(editorElement, {
	lineNumbers: true,
	smartIndent: true,
	value:`
at:cpu@PC(f000)		log "Start address reached!"

// f824 is jump code in Pitfall! -- illustrates state usage in the language.
at:cpu@PC(f824)		{
		log "JUMP!"
                bubble A2 "Message at A2"
                highlight A2
                normal A2
		begin otherjump
	}

<otherjump> at:cpu@PC(f824)	{
		log "JUMP AGAIN!"
		// "" returns to the set of unqualified patterns
		begin ""
	}
`
    });

    // UI State managment

    aok.aok_event.on(aok.aok_event.AOK_MESSAGE, function(eventData){
	standardOutput.innerHTML += "<span class='aok_message_standard_output'>" + eventData.s + "<br>";
    });

    aok.aok_event.on(aok.aok_event.AOK_LOG, function(eventData){
	console.log("AOK_LOG Called: " + eventData.s);
	standardOutput.innerHTML += "<span class='aok_log_standard_output'>" + eventData.s + "</span><br>";
    });

    aok.aok_event.on(aok.aok_event.AOK_BUBBLE, function(eventData){
	var coord_message = "Bubble at coord: " + "<span class='aok_coord_standard_output'>" + eventData.coord +"</span>" + " with message: " + eventData.s + "<br>";
	standardOutput.innerHTML += coord_message;
    });

    aok.aok_event.on(aok.aok_event.AOK_NORMAL, function(eventData){
	var coord_message = "Normal at coord: " + "<span class='aok_coord_standard_output'>" + eventData.coord +"</span>" + "<br>";
	standardOutput.innerHTML += coord_message;
    });

    aok.aok_event.on(aok.aok_event.AOK_HIGHLIGHT, function(eventData){
	var coord_message = "Highlight at coord: " + "<span class ='aok_coord_standard_output'>" + eventData.coord +"</span>" +"<br>";
	standardOutput.innerHTML += coord_message;
    });

    var consoleLimit = 0;
    aok.aok_event.on(aok.aok_event.AOK_FRAME_DISPATCH, function(eventData){
	applyNewTextValuesMap(memVisGridElementArray, eventData);
    });

    aok.aok_event.on(aok.aok_event.AOK_INSTR_DISPATCH, function(eventData){

    });

};
