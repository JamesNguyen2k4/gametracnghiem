function startGame() {
    // Sửa đường dẫn này theo cấu trúc project của bạn
    // Ví dụ nếu file game chính nằm ở ../index.html thì giữ nguyên
    window.location.href = "../play/index.html";
  }
  
  function goToEditor() {
    // Sau này có thể chuyển sang:
    window.location.href = "../question/index.html";
  }
  
  document.addEventListener("DOMContentLoaded", () => {
    const startGameBtn = document.getElementById("startGameBtn");
    const goEditorBtn = document.getElementById("goEditorBtn");
  
    if (startGameBtn) {
      startGameBtn.addEventListener("click", startGame);
    }
  
    if (goEditorBtn) {
      goEditorBtn.addEventListener("click", goToEditor);
    }
  });