//component to manage UI functions of emulator
//and receive information from AOK
jt.aokUI= function(uiElement, atariConsole){

    //hook up aok instance
    var aok = atariConsole.retrieveAOK();

    //setup ui elements
    var editorElement = document.createElement("div");
    editorElement.setAttribute("id", "ui-editor");
    uiElement.appendChild(editorElement);

    var loadCodeButton = document.createElement("button");
    var loadCodeButtonTextNode = document.createTextNode("Load Editor Code");
    loadCodeButton.setAttribute("id", "ui-run-code-button");
    loadCodeButton.appendChild(loadCodeButtonTextNode);
    uiElement.appendChild(loadCodeButton);

    // Just load the current code for now
    loadCodeButton.addEventListener("click", function(){
	aok.newfile(editor.getValue());
    });

    // Currently setting up file loader to have only one file at a time
    if (window.File && window.FileReader && window.FileList && window.Blob){
	var fileSelector = document.createElement("input");
	fileSelector.setAttribute("type", "file");
	fileSelector.setAttribute("id", "ui-file-input");
	uiElement.appendChild(fileSelector);
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


    var editor = CodeMirror(editorElement, {
	lineNumbers: true,
	smartIndent: true,
	value:`
at:cpu@PC(f000)		log "Start address reached!"

// f824 is jump code in Pitfall! -- illustrates state usage in the language.
at:cpu@PC(f824)		{
		log "JUMP!"
		begin otherjump
	}

<otherjump> at:cpu@PC(f824)	{
		log "JUMP AGAIN!"
		// "" returns to the set of unqualified patterns
		begin ""
	}
`


    });



};
