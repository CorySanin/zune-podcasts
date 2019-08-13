const URL = window.location.href;

var computeurl;
window.onload = function() {
    var urlinput = document.getElementById('urlinput');
    var outlabel = document.getElementById('outlabel');
    var urloutput = document.getElementById('urloutput');

    var update = function(){
        urloutput.value = URL + 'out.xml?in=' + encodeURIComponent(urlinput.value);
    }

    var copyurl = function(){
        setTimeout(function(){
            urloutput.focus();
            urloutput.setSelectionRange(0, urloutput.value.length);
        },50);
    }

    computeurl = function(){
        update();
        copyurl();
        return false;
    }

    urlinput.addEventListener('input', update);
    urloutput.addEventListener('mouseup', copyurl);
    outlabel.addEventListener('mouseup', copyurl);

    document.getElementById('outputfields').style.display = 'block';
    update();
};