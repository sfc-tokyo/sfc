var slideIndex = 0;
showSlides();

function showSlides() {
    var i;
    var slides = document.getElementsByClassName("mySlides");
    for (i = 0; i < slides.length; i++) {
        slides[i].style.display = "none";  
    }
    slideIndex++;
    if (slideIndex > slides.length) {slideIndex = 1}    
    slides[slideIndex-1].style.display = "block";  
    setTimeout(showSlides, 2000); // 2秒ごとに画像を切り替える
}

// シンプルなタイプライター効果（#hero-typed に表示）
document.addEventListener('DOMContentLoaded', function () {
    var el = document.getElementById('hero-typed');
    if (!el) return;
    var phrases = ["圧倒的基礎！", "楽しさで伸びる！", "未来のプレーヤーを育てる！"];
    var currentPhrase = 0;
    var currentChar = 0;
    var typing = true;

    function tick() {
        var text = phrases[currentPhrase];
        if (typing) {
            currentChar++;
            el.textContent = text.slice(0, currentChar);
            if (currentChar === text.length) {
                typing = false;
                setTimeout(tick, 1200);
            } else {
                setTimeout(tick, 80);
            }
        } else {
            currentChar--;
            el.textContent = text.slice(0, currentChar);
            if (currentChar === 0) {
                typing = true;
                currentPhrase = (currentPhrase + 1) % phrases.length;
                setTimeout(tick, 200);
            } else {
                setTimeout(tick, 40);
            }
        }
    }
    tick();
});