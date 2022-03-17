<template lang="pug">
.app-container.theme-dark
    .slide-container(v-if='path.length' :class='[operateClass]')
        .slide(
            v-for='(s, index) in currentList'
            :key='index'
            :class='{ active: index === currentIndex, before: index < currentIndex, after: index > currentIndex }'
        )
            .heading(v-html='getTitle(s)')
            .content(v-if='isNavigable(s)')
                ul
                    li(
                        v-for='(s, cIndex) in navigateList(s)'
                        :key='cIndex'
                        :class='{ active: cIndex === activeChildIndex && hasChild(currentSlide) }'
                        v-html='s')
            .content(v-else-if='getChildrenHtml(s)' v-html='getChildrenHtml(s)')
        .navigator
            NIcon.left(size='16px' :class='{ disabled: !hasParent }'): CaretLeft
            NIcon.up(size='16px' :class='{ disabled: !hasPrev }'): CaretUp
            NIcon.right(size='16px' :class='{ disabled: !hasChild(currentSlide) }'): CaretRight
            NIcon.down(size='16px' :class='{ disabled: !hasNext }'): CaretDown
        .pager {{ path.map(i => i + 1).join('.') }} / {{ get(root, 'children.length') }}

    .slide-container(v-else)
        .no-data 暂无内容

</template>

<script>
import { defineComponent, ref } from "vue";
import { get, last, pick } from "lodash";
import { fromMarkdown } from "mdast-util-from-markdown";
import {
    NIcon,
    NRadioGroup,
    NRadioButton,
    NDatePicker,
    NSpace,
} from "naive-ui";
import { CaretLeft, CaretUp, CaretRight, CaretDown } from "@vicons/fa";
import content from "./data/mock";
import AstUtils from "./utils/ast";

// eslint-disable-next-line no-undef
// const vscode = acquireVsCodeApi();

// function update(text) {
//     vscode.postMessage({
//         command: "text",
//         text: text,
//     });
// }

export default defineComponent({
    components: {
        NIcon,
        NRadioGroup,
        NRadioButton,
        NDatePicker,
        NSpace,
        CaretLeft,
        CaretUp,
        CaretRight,
        CaretDown,
    },
    data() {
        return {
            path: [],
            root: null,
            operateClass: "",
            activeChildIndex: 0,
        };
    },
    computed: {
        prevPath() {
            const lastPath = last(this.path);
            return [...this.path.slice(0, this.path.length - 1), lastPath - 1];
        },
        hasPrev() {
            return this.currentIndex > 0;
        },
        hasParent() {
            return (
                this.path.length > 1 &&
                this.currentList[this.currentIndex].parent
            );
        },
        hasNext() {
            return this.currentIndex < this.currentList.length - 1;
        },
        currentList() {
            const node = this.getNode(this.path);
            if (node && node.parent) {
                return node.parent.children || [];
            }
        },
        currentIndex() {
            return last(this.path);
        },
        currentSlide() {
            return this.currentList[this.currentIndex];
        },
    },
    created() {
        window.addEventListener("message", (event) => {
            const message = event.data;
            switch (message.command) {
                case "content":
                    console.log("vue on msg", message.data);
                    this.init(message.data);
                    break;
            }
        });
    },
    async mounted() {
        this.init(content);
        window.addEventListener("keydown", this.handleKeyDown);
    },
    beforeUnmount() {
        window.removeEventListener("keydown", this.handleKeyDown);
    },
    methods: {
        get: get,
        last: last,
        ...pick(AstUtils, [
            "isHeading",
            "isList",
            "hasChild",
            "isNavigable",
            "getChildrenHtml",
            "navigateList",
        ]),
        init(content) {
            this.root = AstUtils.transformToSlideTree(fromMarkdown(content));
            console.log(this.root);
            if (this.root.children.length) {
                this.path = [0, 1];
            } else {
                this.path = [];
            }
        },
        handleKeyDown(e) {
            const isNavigable = this.isNavigable(this.currentSlide);
            const navigateList = this.navigateList(this.currentSlide);
            switch (e.keyCode) {
                case 37: // left
                    if (this.hasParent) {
                        this.activeChildIndex = 0;
                        this.path.pop();
                    }
                    this.operateClass = "left";
                    break;
                case 38: // top
                    if (isNavigable && this.activeChildIndex > 0) {
                        this.activeChildIndex--;
                    } else if (this.hasPrev) {
                        this.path[this.path.length - 1] = last(this.path) - 1;
                    }
                    this.operateClass = "";
                    break;
                case 39: // right
                    if (this.hasChild(this.currentSlide)) {
                        if (isNavigable) {
                            this.path.push(this.activeChildIndex);
                            this.activeChildIndex = 0;
                        } else {
                            this.path.push(0);
                        }
                    }
                    this.operateClass = "right";
                    break;
                case 40: // bottom
                case 32: // blank
                case 13: // enter
                    if (
                        isNavigable &&
                        this.activeChildIndex < navigateList.length - 1 &&
                        this.hasChild(this.currentSlide)
                    ) {
                        this.activeChildIndex++;
                    } else if (this.hasNext) {
                        this.path[this.path.length - 1] = last(this.path) + 1;
                    }
                    this.operateClass = "";
                    break;
            }
        },
        getNode(path) {
            let rs = this.root;
            path.forEach((idx) => {
                rs = rs.children[idx];
            });
            return rs;
        },
        getTitle(node) {
            const titles = [];
            let temp = node;
            while (temp) {
                titles.unshift(temp.title);
                temp = temp.parent;
            }
            return titles.filter((t) => t).join("&nbsp;/&nbsp;");
        },
    },
});
</script>

<style lang="sass">
*
    box-sizing: border-box
html
    font-size: 100px
body
    -webkit-font-smoothing: antialiased
    -moz-osx-font-smoothing: grayscale
    margin: 0
    line-height: 1.3
html, body, #app
    display: flex
    flex: 1
    height: 100%
    overflow: hidden

h1, h2, h3, h4, h5, h6
    font-weight: 500
    display: block
h1
    font-size: 0.52rem
    font-weight: 600
h2
    font-size: 0.48rem
h3
    font-size: 0.42rem
h4
    font-size: 0.38rem
h5
    font-size: 0.32

.slide-container
    .title
        h1, h2, h3, h4, h5, h6
            font-size: 0.32rem
            padding: 0 8px
    .content
        h1, h2, h3, h4, h5, h6
            font-size: 0.24rem
            font-weight: 500
            padding: 0 0.24rem
            text-align: left
    ul, ol
        flex: 1
        width: 100%
        font-size: 0.32rem
        ul, ol
            padding: 0.24rem 0.32rem
        li
            margin-bottom: 0.14rem
            transition: font-size 400ms, color 400ms
    code
        font-size: 22rem

    li.active
        color: #18a058
        font-weight: 500
        font-size: 0.36rem

// Theme
.theme-dark
    .slide-container
        background: #222
        color: #eee
    .pager
        color: #eee
    a
        color: #eee
        font-style: underline

// Transition
.slide
    &.active
        left: 0
        top: 0
        bottom: 0
    &.before
        top:  -100vh
        bottom: 100vh
    &.after
        top: 100vh
        bottom: -100vh
.slide-container.left
    &.before
        left: -100vw
    &.after
        left: 100vw
.slide-container.right
    &.before
        left: 100vw
    &.after
        left: -100vw
</style>
<style lang="sass" scoped>
.app-container
    display: flex
    flex: 0 0 100%
    flex-direction: column
    color: #2c3e50
    overflow: hidden
.slide-container
    display: flex
    flex: 1
    justify-content: center
    align-items: center
    overflow: hidden

.navigator
    .left, .up, .right, .down
        color: #ccc
        &.disabled
            color: #666
.pager
    position: absolute
    left: 20px
    bottom: 20px
.navigator
    position: absolute
    bottom: 20px
    right: 20px
    width: 40px
    height: 40px
    .left
        position: absolute
        left: 0
        top: 50%
        transform: translate(0, -50%)
    .right
        position: absolute
        right: 0
        top: 50%
        transform: translate(0, -50%)
    .up
        position: absolute
        top: 0
        left: 50%
        transform: translate(-50%, 0)
    .down
        position: absolute
        bottom: 0
        left: 50%
        transform: translate(-50%, 0)
.slide
    position: absolute
    min-width: 100%
    min-height: 100%
    display: flex
    justify-content: center
    flex-direction: column
    overflow: hidden
    font-size: 0.24rem
    transition: left 400ms, top 400ms, right 400ms, bottom 400ms
    .heading
        display: flex
        flex: 0 0 auto
        align-items: center
        justify-content: center
        font-size: 0.36rem
        font-weight: 500
        padding: 0.32rem 0 0.24rem
        opacity: 0.8
    .title
        display: flex
        width: 100%
        align-items: center
        padding-left: 20px
        box-sizing: border-box
        font-size: 32px
        text-align: left
    .content
        display: flex
        flex: 1
        overflow: auto
        padding: 0 0.4rem
        flex-direction: column
    .title + .content
        text-align: left
        font-size: 28px
</style>
