(() => {
    const comments = document.querySelector("[data-mastodon-comments]");
    if (!comments) {
        return;
    }

    const button = comments.querySelector(".comments-load");
    const message = comments.querySelector(".comments-status");
    const list = comments.querySelector(".comments-wrapper");
    const { host, statusId, username } = comments.dataset;

    function element(tag, className, text) {
        const node = document.createElement(tag);
        node.className = className;
        if (text !== undefined) {
            node.textContent = text;
        }
        return node;
    }

    function safeUrl(value) {
        try {
            const url = new URL(value);
            return url.protocol === "https:" ? url.href : null;
        } catch {
            return null;
        }
    }

    function link(url, text) {
        const href = safeUrl(url);
        if (!href) {
            return element("span", "", text);
        }

        const node = element("a", "", text);
        node.href = href;
        node.rel = "external nofollow ugc noreferrer";
        return node;
    }

    function renderComment(status) {
        const { account } = status;
        if (!account || typeof status.content !== "string") {
            return null;
        }

        const comment = element("article", "comment");
        if (status.in_reply_to_id !== statusId) {
            comment.classList.add("comment-reply");
        }
        if (account.acct === username) {
            comment.classList.add("comment-author");
        }

        const header = element("header", "comment-header");
        const avatarUrl = safeUrl(account.avatar_static);
        if (avatarUrl) {
            const avatar = element("img", "avatar");
            avatar.src = avatarUrl;
            avatar.alt = "";
            avatar.width = 64;
            avatar.height = 64;
            avatar.loading = "lazy";
            header.append(avatar);
        }

        const author = element("div", "comment-header-info");
        author.append(
            element("strong", "comment-display-name", account.display_name || account.username),
            link(account.url, `@${account.acct}`)
        );

        const date = new Date(status.created_at);
        const time = element("time", "");
        if (!Number.isNaN(date.getTime())) {
            time.dateTime = date.toISOString();
            time.append(link(status.url, date.toLocaleString("en-GB")));
            author.append(time);
        }

        header.append(author);
        comment.append(header);

        const body = element("div", "comment-content");
        const content = DOMPurify.sanitize(status.content, {
            ALLOWED_TAGS: [
                "a", "blockquote", "br", "code", "del", "em", "li", "ol",
                "p", "pre", "span", "strong", "ul"
            ],
            ALLOWED_ATTR: ["class", "href"],
            RETURN_DOM_FRAGMENT: true
        });

        content.querySelectorAll("a").forEach((anchor) => {
            const href = safeUrl(anchor.href);
            if (href) {
                anchor.href = href;
                anchor.rel = "external nofollow ugc noreferrer";
            } else {
                anchor.removeAttribute("href");
            }
        });
        body.append(content);

        if (status.spoiler_text || status.sensitive) {
            const details = document.createElement("details");
            details.append(
                element("summary", "", status.spoiler_text || "Sensitive content"),
                body
            );
            comment.append(details);
        } else {
            comment.append(body);
        }

        return comment;
    }

    button.addEventListener("click", async () => {
        button.disabled = true;
        message.textContent = "Loading comments…";

        try {
            const response = await fetch(
                `https://${host}/api/v1/statuses/${statusId}/context`
            );
            if (!response.ok) {
                throw new Error(`Mastodon returned ${response.status}`);
            }

            const { descendants } = await response.json();
            if (!Array.isArray(descendants)) {
                throw new Error("Unexpected Mastodon response");
            }

            const rendered = descendants.map(renderComment).filter(Boolean);
            list.replaceChildren(...rendered);
            message.textContent = rendered.length
                ? `${rendered.length} ${rendered.length === 1 ? "comment" : "comments"} loaded.`
                : "No comments yet.";
            button.hidden = true;
        } catch (error) {
            console.error("Could not load Mastodon comments:", error);
            message.textContent = "Comments could not be loaded.";
            button.disabled = false;
            button.textContent = "Try again";
        }
    });
})();
