const URL = window.location.href;
const URLPREFIX = URL + 'feed/out.xml?in=';
const ZUNESUB = 'zune://subscribe/?zune-podcasts=';

var computeurl;
window.onload = function() {
    var urlinput = document.getElementById('urlinput');
    var outlabel = document.getElementById('outlabel');
    var urloutput = document.getElementById('urloutput');
    var zunesubscribe = document.getElementById('zunesubscribe');

    var update = function(){
        urloutput.value = URLPREFIX + encodeURIComponent(urlinput.value);
        zunesubscribe.href = ZUNESUB + URLPREFIX + urlinput.value;
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