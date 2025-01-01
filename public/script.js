$(document).ready(function () {
  const baseUrl = "http://localhost:3000";

  // Load judul list
  function loadJudul() {
    $.get(`${baseUrl}/api/komik`, function (data) {
      const judulTableBody = $("#judul-list tbody");
      judulTableBody.empty();
      data.forEach((judul, index) => {
        judulTableBody.append(`
                <tr data-judul="${judul}">
                    <td>${index + 1}</td>
                    <td>${judul}</td>
                </tr>
            `);
      });

      // Cek localStorage untuk judul terakhir
      const currentJudul = localStorage.getItem("currentJudul");
      if (currentJudul) {
        loadChapter(currentJudul);
      }
    });
  }

  // Load chapter list
  function loadChapter(judul) {
    $.get(`${baseUrl}/api/komik/${judul}`, function (data) {
      const chapterListTop = $(".chapter-list");
      const chapterListBottom = $(".chapter-list-bottom");

      chapterListTop.empty();
      chapterListBottom.empty();

      data.forEach((chapter) => {
        const optionHtml = `<option value="${chapter}" data-judul="${judul}">${chapter}</option>`;
        chapterListTop.append(optionHtml);
        chapterListBottom.append(optionHtml);
      });

      const currentChapter = localStorage.getItem("currentChapter");
      const initialChapter =
        currentChapter && data.includes(currentChapter)
          ? currentChapter
          : data[0];

      chapterListTop.val(initialChapter);
      chapterListBottom.val(initialChapter);

      updateNavigationButtons(data, initialChapter);
      loadImages(judul, initialChapter);

      $("#chapter-section").show();
    });
  }

  // Load images
  function loadImages(judul, chapter) {
    $.get(`${baseUrl}/api/komik/${judul}/${chapter}`, function (data) {
      const imageList = $("#image-list");
      imageList.empty();
      data.forEach((imageUrl) => {
        imageList.append(`<img src="${baseUrl}${imageUrl}" alt="Image">`);
      });

      $("#image-section").show();
      localStorage.setItem("currentJudul", judul);
      localStorage.setItem("currentChapter", chapter);
    });
  }

  // Update navigation buttons
  function updateNavigationButtons(chapters, currentChapter) {
    const currentIndex = chapters.indexOf(currentChapter);
    const isFirstChapter = currentIndex === 0;
    const isLastChapter = currentIndex === chapters.length - 1;

    // Update tombol di atas
    $("#prev-chapter").prop("disabled", isFirstChapter);
    $("#next-chapter").prop("disabled", isLastChapter);

    // Update tombol di bawah
    $("#prev-chapter-bottom").prop("disabled", isFirstChapter);
    $("#next-chapter-bottom").prop("disabled", isLastChapter);
  }

  // Event listeners
  $("#judul-list").on("click", "tr", function () {
    const judul = $(this).data("judul");

    // Reset chapter jika judul berubah
    const currentJudul = localStorage.getItem("currentJudul");
    if (currentJudul !== judul) {
      localStorage.removeItem("currentChapter");
    }

    loadChapter(judul);
  });

  $(".chapter-list").on("change", function () {
    const chapter = $(this).val();
    $(".chapter-list-bottom").val(chapter);
    const judul = localStorage.getItem("currentJudul");
    const chapters = $(".chapter-list option")
      .map((_, el) => $(el).val())
      .get();
    updateNavigationButtons(chapters, chapter);
    loadImages(judul, chapter);
  });

  $(".chapter-list-bottom").on("change", function () {
    const chapter = $(this).val();
    $(".chapter-list").val(chapter);
    const judul = localStorage.getItem("currentJudul");
    const chapters = $(".chapter-list option")
      .map((_, el) => $(el).val())
      .get();
    updateNavigationButtons(chapters, chapter);
    loadImages(judul, chapter);
  });

  $("#prev-chapter").on("click", function () {
    navigateToPreviousChapter();
  });
  $("#prev-chapter-bottom").on("click", function () {
    navigateToPreviousChapter();
  });

  $("#next-chapter").on("click", function () {
    navigateToNextChapter();
  });
  $("#next-chapter-bottom").on("click", function () {
    navigateToNextChapter();
  });

  // jika key shift dan arrow right di press, maka akan pindah ke halaman berikutnya
  $(document).keydown(function (e) {
    if (e.shiftKey && e.keyCode === 39) {
      navigateToNextChapter();
    }
    if (e.shiftKey && e.keyCode === 37) {
      navigateToPreviousChapter();
    }
  });

  function navigateToPreviousChapter() {
    const chapters = $(".chapter-list option")
      .map((_, el) => $(el).val())
      .get();
    const currentChapter = $(".chapter-list").val();
    const prevIndex = chapters.indexOf(currentChapter) - 1;
    if (prevIndex >= 0) {
      $(".chapter-list, .chapter-list-bottom")
        .val(chapters[prevIndex])
        .trigger("change");
      updateNavigationButtons(chapters, chapters[prevIndex]);
    }
  }

  function navigateToNextChapter() {
    const chapters = $(".chapter-list option")
      .map((_, el) => $(el).val())
      .get();
    const currentChapter = $(".chapter-list").val();
    const nextIndex = chapters.indexOf(currentChapter) + 1;
    if (nextIndex < chapters.length) {
      $(".chapter-list, .chapter-list-bottom")
        .val(chapters[nextIndex])
        .trigger("change");
      updateNavigationButtons(chapters, chapters[nextIndex]);
    }
  }

  loadJudul();
});
