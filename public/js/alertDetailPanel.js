(function () {
  "use strict";

  var panelEl = null;
  var currentPostId = null;
  var fetchController = null;

  function getPanel() {
    if (!panelEl) panelEl = document.getElementById("alertDetailPanel");
    return panelEl;
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function categoryClass(cat) {
    var m = {
      Safety: "cat-Safety",
      Outage: "cat-Outage",
      Weather: "cat-Weather",
      Fire: "cat-Fire",
      Traffic: "cat-Traffic",
    };
    return m[cat] || "cat-default";
  }

  function setSelectedListItem(postId) {
    document.querySelectorAll(".alert-list-item").forEach(function (el) {
      el.classList.toggle("is-selected", postId && el.getAttribute("data-post-id") === String(postId));
    });
  }

  function showPanel() {
    var panel = getPanel();
    if (!panel) return;
    panel.classList.add("is-open");
    panel.setAttribute("aria-hidden", "false");
    panel.classList.remove("is-loading");
  }

  function closeAlertDetailPanel() {
    var panel = getPanel();
    currentPostId = null;
    if (fetchController) {
      fetchController.abort();
      fetchController = null;
    }
    if (panel) {
      panel.classList.remove("is-open", "is-loading");
      panel.setAttribute("aria-hidden", "true");
    }
    setSelectedListItem(null);
  }

  function showLoading() {
    var panel = getPanel();
    var header = document.getElementById("alertDetailPanelHeader");
    var body = document.getElementById("alertDetailPanelBody");
    if (panel) panel.classList.add("is-loading");
    if (header) {
      header.innerHTML = '<span class="text-muted" style="font-size:11.5px;">Loading&hellip;</span>';
    }
    if (body) {
      body.innerHTML =
        '<div class="text-center py-4 text-muted">' +
        '<div class="spinner-border spinner-border-sm text-primary mb-2" role="status"></div>' +
        '<div style="font-size:12px;">Loading alert&hellip;</div></div>';
    }
  }

  function showError(message) {
    var panel = getPanel();
    var body = document.getElementById("alertDetailPanelBody");
    if (panel) panel.classList.remove("is-loading");
    if (!body) return;
    body.innerHTML =
      '<div class="text-center py-4 text-danger" style="font-size:12px;">' +
      '<i class="bi bi-exclamation-circle me-1"></i>' +
      escapeHtml(message || "Could not load this alert.") +
      "</div>";
  }

  function renderImages(images, postId) {
    if (!images || images.length === 0) return "";

    if (images.length === 1) {
      return (
        '<div class="mb-2">' +
        '<img src="' +
        escapeHtml(images[0].url) +
        '" alt="Alert image" class="w-100 rounded-2 alert-detail-panel__img">' +
        "</div>"
      );
    }

    var carouselId = "alert-panel-carousel-" + postId;
    var html =
      '<div id="' +
      carouselId +
      '" class="carousel slide mb-2" data-bs-ride="false" data-bs-wrap="false">' +
      '<div class="carousel-inner rounded-2 alert-detail-panel__carousel">';

    images.forEach(function (img, idx) {
      html +=
        '<div class="carousel-item' +
        (idx === 0 ? " active" : "") +
        '"><img src="' +
        escapeHtml(img.url) +
        '" class="d-block w-100 rounded-2 alert-detail-panel__img" alt="Alert image ' +
        (idx + 1) +
        '"></div>';
    });

    html +=
      '</div>' +
      '<button class="carousel-control-prev" type="button" data-bs-target="#' +
      carouselId +
      '" data-bs-slide="prev"><span class="carousel-control-prev-icon"></span></button>' +
      '<button class="carousel-control-next" type="button" data-bs-target="#' +
      carouselId +
      '" data-bs-slide="next"><span class="carousel-control-next-icon"></span></button></div>';

    return html;
  }

  function renderComments(comments) {
    if (!comments || comments.length === 0) {
      return '<p class="text-muted text-center py-2 mb-0" style="font-size:12px;">No comments yet.</p>';
    }

    var html = "";
    comments.forEach(function (c) {
      html +=
        '<div class="alert-detail-comment' +
        (c.isPinned ? " alert-detail-comment--pinned" : "") +
        '">' +
        '<div class="d-flex align-items-center gap-2 mb-1">' +
        '<img src="' +
        escapeHtml(c.author.profileImage) +
        '" alt="" class="rounded-circle border" style="width:22px;height:22px;object-fit:cover;">' +
        '<div class="min-width-0 flex-grow-1">' +
        '<a href="/users/' +
        escapeHtml(c.author._id) +
        '" class="fw-semibold text-decoration-none" style="font-size:12px;color:#04888D;">' +
        escapeHtml(c.author.name) +
        "</a>" +
        '<div class="text-muted" style="font-size:10.5px;">' +
        escapeHtml(c.formattedDate) +
        "</div></div></div>" +
        '<p class="mb-0" style="font-size:12px;line-height:1.5;white-space:pre-wrap;">' +
        escapeHtml(c.text) +
        "</p></div>";
    });
    return html;
  }

  function renderPost(data) {
    var post = data.post;
    var comments = data.comments || [];
    var header = document.getElementById("alertDetailPanelHeader");
    var body = document.getElementById("alertDetailPanelBody");
    var panel = getPanel();
    if (!header || !body) return;

    var statusLabel =
      typeof renderAlertStatus === "function"
        ? renderAlertStatus(post.alertStatus === "Resolved" ? "Resolved" : "Active")
        : "";
    var catCls = categoryClass(post.alertCategory);
    var catBadge = post.alertCategory
      ? '<span class="ali-category ' + catCls + '">' + escapeHtml(post.alertCategory) + "</span>"
      : '<span class="ali-category cat-default">Alert</span>';

    header.innerHTML =
      '<div class="d-flex align-items-center gap-2 min-width-0">' +
      '<img src="' +
      escapeHtml(post.author.profileImage) +
      '" alt="" class="rounded-circle border flex-shrink-0" style="width:28px;height:28px;object-fit:cover;">' +
      '<div class="min-width-0">' +
      '<a href="/users/' +
      escapeHtml(post.author._id) +
      '" class="fw-semibold text-dark text-decoration-none d-block text-truncate" style="font-size:12px;">' +
      escapeHtml(post.author.name) +
      "</a>" +
      '<div class="text-muted text-truncate" style="font-size:10.5px;">' +
      '<i class="bi bi-clock me-1"></i>' +
      escapeHtml(post.formattedDate) +
      "</div></div></div>";

    var locationHtml = post.locationName
      ? '<div class="alert-detail-meta-row"><i class="bi bi-geo-alt me-1"></i>' +
        escapeHtml(post.locationName) +
        "</div>"
      : "";
    var radiusHtml = post.alertRadius
      ? '<div class="alert-detail-meta-row"><i class="bi bi-broadcast me-1"></i>Radius: ' +
        escapeHtml(post.alertRadius) +
        "</div>"
      : "";

    body.innerHTML =
      '<div class="alert-detail-panel__content alert-detail-fade-in">' +
      '<div class="alert-card-header mb-2">' +
      catBadge +
      statusLabel +
      "</div>" +
      '<h2 class="alert-detail-title">' +
      escapeHtml(post.title) +
      "</h2>" +
      (locationHtml || radiusHtml
        ? '<div class="alert-detail-meta mb-2">' + locationHtml + radiusHtml + "</div>"
        : "") +
      renderImages(post.images, post._id) +
      '<div class="alert-detail-description text-secondary">' +
      post.descriptionHtml +
      "</div>" +
      '<div class="alert-detail-comments">' +
      '<h6 class="alert-detail-comments__title"><i class="bi bi-chat-left-dots me-1"></i>Comments (' +
      comments.length +
      ")</h6>" +
      '<form id="alertDetailCommentForm" class="mb-2">' +
      '<textarea id="alertDetailCommentText" name="text" class="form-control form-control-sm" rows="2" placeholder="Add a comment..." required></textarea>' +
      '<div id="alertDetailCommentError" class="text-danger small mt-1" style="display:none;"></div>' +
      '<button type="submit" class="btn btn-sm btn-primary mt-1 px-3" style="font-size:11.5px;">Post</button>' +
      "</form>" +
      '<div id="alertDetailCommentsList">' +
      renderComments(comments) +
      "</div></div></div>";

    if (panel) panel.classList.remove("is-loading");

    var form = document.getElementById("alertDetailCommentForm");
    if (form) form.addEventListener("submit", onCommentSubmit);
  }

  function loadPost(postId) {
    if (fetchController) fetchController.abort();
    fetchController = new AbortController();

    return fetch("/api/posts/" + encodeURIComponent(postId), {
      headers: { Accept: "application/json" },
      signal: fetchController.signal,
    })
      .then(function (r) {
        if (!r.ok) {
          return r.json().catch(function () {
            return {};
          }).then(function (data) {
            throw new Error(data.error || "Failed to load alert");
          });
        }
        return r.json();
      })
      .then(function (data) {
        if (currentPostId !== postId) return;
        renderPost(data);
      })
      .catch(function (err) {
        if (err.name === "AbortError") return;
        if (currentPostId !== postId) return;
        showError(err.message);
      });
  }

  function onCommentSubmit(e) {
    e.preventDefault();
    if (!currentPostId) return;

    var textarea = document.getElementById("alertDetailCommentText");
    var errorEl = document.getElementById("alertDetailCommentError");
    var submitBtn = e.target.querySelector('button[type="submit"]');
    var text = textarea ? textarea.value.trim() : "";

    if (!text) {
      if (errorEl) {
        errorEl.textContent = "Comment cannot be empty";
        errorEl.style.display = "";
      }
      return;
    }

    if (errorEl) errorEl.style.display = "none";
    if (submitBtn) submitBtn.disabled = true;

    var body = new URLSearchParams();
    body.append("text", text);

    fetch("/posts/" + encodeURIComponent(currentPostId) + "/comments", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: body.toString(),
    })
      .then(function (r) {
        return r.json().then(function (data) {
          return { ok: r.ok, data: data };
        });
      })
      .then(function (result) {
        if (!result.ok || !result.data.success) {
          throw new Error(result.data.message || "Could not post comment");
        }
        if (textarea) textarea.value = "";
        var list = document.getElementById("alertDetailCommentsList");
        if (list) {
          var empty = list.querySelector(".text-muted.text-center");
          if (empty) empty.remove();
          var div = document.createElement("div");
          div.innerHTML = renderComments([result.data.comment]);
          list.insertBefore(div.firstChild, list.firstChild);
        }
        var heading = document.querySelector(".alert-detail-comments__title");
        if (heading) {
          var count = document.querySelectorAll("#alertDetailCommentsList .alert-detail-comment").length;
          heading.innerHTML =
            '<i class="bi bi-chat-left-dots me-1"></i>Comments (' + count + ")";
        }
      })
      .catch(function (err) {
        if (errorEl) {
          errorEl.textContent = err.message || "Could not post comment";
          errorEl.style.display = "";
        }
      })
      .finally(function () {
        if (submitBtn) submitBtn.disabled = false;
      });
  }

  function openAlertDetailPanel(postId) {
    if (!postId) return;
    var id = String(postId);
    var isSwitch = currentPostId && currentPostId !== id;
    currentPostId = id;
    setSelectedListItem(id);
    showPanel();
    if (isSwitch) {
      var body = document.getElementById("alertDetailPanelBody");
      if (body) body.classList.add("is-switching");
      setTimeout(function () {
        if (body) body.classList.remove("is-switching");
      }, 180);
    }
    showLoading();
    loadPost(id);
  }

  window.openAlertDetailPanel = openAlertDetailPanel;
  window.openAlertPostModal = openAlertDetailPanel;
  window.closeAlertDetailPanel = closeAlertDetailPanel;

  document.addEventListener("DOMContentLoaded", function () {
    var closeBtn = document.getElementById("alertDetailPanelClose");
    if (closeBtn) {
      closeBtn.addEventListener("click", function (e) {
        e.preventDefault();
        closeAlertDetailPanel();
      });
    }

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && getPanel() && getPanel().classList.contains("is-open")) {
        closeAlertDetailPanel();
      }
    });
  });

  document.addEventListener("click", function (e) {
    var listItem = e.target.closest(".alert-list-item[data-post-id]");
    if (listItem) {
      e.preventDefault();
      openAlertDetailPanel(listItem.getAttribute("data-post-id"));
      return;
    }

    var mapLink = e.target.closest(".alert-view-post-link");
    if (mapLink) {
      e.preventDefault();
      openAlertDetailPanel(mapLink.getAttribute("data-post-id"));
    }
  });
})();
