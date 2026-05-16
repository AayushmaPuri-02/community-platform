(function () {
    'use strict';

    var origin = window.location.origin;

    // Fix WhatsApp links with real origin (server rendered localhost placeholder)
    document.querySelectorAll('.wa-share-link').forEach(function (a) {
        var pid = a.getAttribute('data-postid');
        var title = a.getAttribute('data-title');
        a.href = 'https://wa.me/?text=' + encodeURIComponent(title + ' \u2014 ' + origin + '/posts/' + pid);
    });

    // Copy link buttons
    document.querySelectorAll('.copy-link-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var pid = btn.getAttribute('data-postid');
            var url = origin + '/posts/' + pid;
            var msg = btn.querySelector('.copy-msg');
            if (navigator.clipboard) {
                navigator.clipboard.writeText(url).then(function () {
                    msg.style.display = 'inline';
                    setTimeout(function () { msg.style.display = 'none'; }, 2000);
                });
            } else {
                var ta = document.createElement('textarea');
                ta.value = url;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                msg.style.display = 'inline';
                setTimeout(function () { msg.style.display = 'none'; }, 2000);
            }
        });
    });

    // ── Send in message — single shared modal injected once ──────────────────
    var currentPostId = null;
    var currentPostTitle = null;
    var recipientsLoaded = false;

    // Build modal DOM without any closing-tag strings that confuse EJS
    function buildModal() {
        var modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = 'feedSendMsgModal';
        modal.setAttribute('tabindex', '-1');
        modal.setAttribute('aria-hidden', 'true');

        modal.innerHTML = [
            '<div class="modal-dialog modal-dialog-centered" style="max-width:380px;">',
            '<div class="modal-content border-0 rounded-4 shadow">',
            '<div class="modal-header border-0 pb-0">',
            '<h5 class="modal-title fw-bold">Send in Message</h5>',
            '<button type="button" class="btn-close" data-bs-dismiss="modal"></button>',
            '</div>',
            '<div class="modal-body">',
            '<div class="mb-3">',
            '<label class="form-label fw-semibold small">Send to</label>',
            '<select id="feedMsgRecipient" class="form-select">',
            '<option value="">Loading\u2026</option>',
            '</select>',
            '</div>',
            '<div class="mb-3">',
            '<label class="form-label fw-semibold small">Message</label>',
            '<input type="text" id="feedMsgPreview" class="form-control" readonly>',
            '</div>',
            '<div id="feedMsgError" class="text-danger small mb-2" style="display:none;"></div>',
            '</div>',
            '<div class="modal-footer border-0">',
            '<button type="button" class="btn btn-light rounded-pill px-4" data-bs-dismiss="modal">Cancel</button>',
            '<button type="button" id="feedMsgSendBtn" class="btn btn-success rounded-pill px-4">Send</button>',
            '</div>',
            '</div>',
            '</div>'
        ].join('');

        document.body.appendChild(modal);
    }

    buildModal();

    var feedModalEl = document.getElementById('feedSendMsgModal');
    var recipientSel = document.getElementById('feedMsgRecipient');
    var msgPreviewEl = document.getElementById('feedMsgPreview');
    var msgErrorEl = document.getElementById('feedMsgError');
    var sendBtn = document.getElementById('feedMsgSendBtn');

    document.querySelectorAll('.open-send-msg-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            currentPostId = btn.getAttribute('data-postid');
            currentPostTitle = btn.getAttribute('data-title');

            var shareModalId = btn.getAttribute('data-sharemodalid');
            var shareEl = document.getElementById(shareModalId);
            if (shareEl && bootstrap.Modal.getInstance(shareEl)) {
                bootstrap.Modal.getInstance(shareEl).hide();
            }

            msgPreviewEl.value = 'Shared a post: ' + currentPostTitle + ' \u2014 ' + origin + '/posts/' + currentPostId;
            msgErrorEl.style.display = 'none';
            sendBtn.disabled = false;
            sendBtn.textContent = 'Send';

            setTimeout(function () {
                new bootstrap.Modal(feedModalEl).show();
            }, 300);

            if (!recipientsLoaded) {
                fetch('/share/recipients')
                    .then(function (r) { return r.json(); })
                    .then(function (list) {
                        recipientSel.innerHTML = '';
                        var placeholder = document.createElement('option');
                        placeholder.value = '';
                        placeholder.textContent = '\u2014 Choose a recipient \u2014';
                        recipientSel.appendChild(placeholder);

                        list.forEach(function (u) {
                            var opt = document.createElement('option');
                            opt.value = u._id;
                            opt.textContent = u.name + ' (' + u.role + ')';
                            recipientSel.appendChild(opt);
                        });
                        recipientsLoaded = true;
                    })
                    .catch(function () {
                        recipientSel.innerHTML = '';
                        var errOpt = document.createElement('option');
                        errOpt.value = '';
                        errOpt.textContent = 'Could not load recipients';
                        recipientSel.appendChild(errOpt);
                    });
            }
        });
    });

    sendBtn.addEventListener('click', function () {
        var recipientId = recipientSel.value;
        if (!recipientId) {
            msgErrorEl.textContent = 'Please select a recipient.';
            msgErrorEl.style.display = 'block';
            return;
        }
        msgErrorEl.style.display = 'none';
        sendBtn.disabled = true;
        sendBtn.textContent = 'Sending\u2026';

        var form = document.createElement('form');
        form.method = 'POST';
        form.action = '/messages/' + recipientId;
        var input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'text';
        input.value = msgPreviewEl.value;
        form.appendChild(input);
        document.body.appendChild(form);
        form.submit();
    });

})();
