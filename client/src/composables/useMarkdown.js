import MarkdownIt from "markdown-it";

const md = MarkdownIt();

function addRuleOpenLinksInNewPage(md) {
    var defaultRender =
        md.renderer.rules.link_open ||
        function (tokens, idx, options, env, self) {
            return self.renderToken(tokens, idx, options);
        };
    md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
        var aIndex = tokens[idx].attrIndex("target");
        if (aIndex < 0) {
            tokens[idx].attrPush(["target", "_blank"]);
        } else {
            tokens[idx].attrs[aIndex][1] = "_blank";
        }
        return defaultRender(tokens, idx, options, env, self);
    };
}

export function useMarkdown(options = {}) {
    if (options.openLinksInNewPage) {
        addRuleOpenLinksInNewPage(md);
    }

    return md;
}
