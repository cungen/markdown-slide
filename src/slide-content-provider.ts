import * as fs from "fs";
import { tmpdir } from "os";
import * as path from "path";
import * as vscode from "vscode";
import { TextEditor, Uri } from "vscode";
import _ = require("lodash");
import { getAssets, getWebviewContent } from "./util";

export class MarkdownSlideView {
    /**
     * The key is markdown file fspath
     * value is Preview (vscode.Webview) object
     */
    private previewMaps: { [key: string]: vscode.WebviewPanel } = {};

    private preview2EditorMap: Map<vscode.WebviewPanel, vscode.TextEditor> =
        new Map();

    private singlePreviewPanel: vscode.WebviewPanel | null = null;
    private singlePreviewPanelSourceUriTarget: Uri | null = null;

    /**
     * The key is markdown file fsPath
     * value is JSAndCssFiles
     */
    private jsAndCssFilesMaps: { [key: string]: string[] } = {};

    public constructor(private context: vscode.ExtensionContext) {
        this.context = context
    }

    private refreshAllPreviews() {
        // refresh iframes
        if (useSinglePreview()) {
            this.refreshPreviewPanel(this.singlePreviewPanelSourceUriTarget!);
        } else {
            for (const key in this.previewMaps) {
                if (this.previewMaps.hasOwnProperty(key)) {
                    this.refreshPreviewPanel(vscode.Uri.file(key));
                }
            }
        }
    }

    /**
     * return markdown preview of sourceUri
     * @param sourceUri
     */
    public getPreview(sourceUri: Uri): vscode.WebviewPanel {
        if (useSinglePreview()) {
            return this.singlePreviewPanel!;
        } else {
            return this.previewMaps[sourceUri.fsPath];
        }
    }

    /**
     * check if the markdown preview is on for the textEditor
     * @param textEditor
     */
    public isPreviewOn(sourceUri: Uri) {
        if (useSinglePreview()) {
            return !!this.singlePreviewPanel;
        } else {
            return !!this.getPreview(sourceUri);
        }
    }

    public destroyPreview(sourceUri: Uri) {
        if (useSinglePreview()) {
            this.singlePreviewPanel = null;
            this.singlePreviewPanelSourceUriTarget = null;
            this.preview2EditorMap = new Map();
            this.previewMaps = {};
        } else {
            const previewPanel = this.getPreview(sourceUri);
            if (previewPanel) {
                this.preview2EditorMap.delete(previewPanel);
                delete this.previewMaps[sourceUri.fsPath];
            }
        }
    }

    /**
     * Format pathString if it is on Windows. Convert `c:\` like string to `C:\`
     * @param pathString
     */
    private formatPathIfNecessary(pathString: string) {
        if (process.platform === "win32") {
            pathString = pathString.replace(
                /^([a-zA-Z])\:\\/,
                (_, $1) => `${$1.toUpperCase()}:\\`
            );
        }
        return pathString;
    }

    private getProjectDirectoryPath(
        sourceUri: Uri,
        workspaceFolders: readonly vscode.WorkspaceFolder[] = []
    ) {
        const possibleWorkspaceFolders = workspaceFolders.filter(
            (workspaceFolder) => {
                return (
                    path
                        .dirname(sourceUri.path.toUpperCase())
                        .indexOf(workspaceFolder.uri.path.toUpperCase()) >= 0
                );
            }
        );

        let projectDirectoryPath;
        if (possibleWorkspaceFolders.length) {
            // We pick the workspaceUri that has the longest path
            const workspaceFolder = possibleWorkspaceFolders.sort(
                (x, y) => y.uri.fsPath.length - x.uri.fsPath.length
            )[0];
            projectDirectoryPath = workspaceFolder.uri.fsPath;
        } else {
            projectDirectoryPath = "";
        }

        return this.formatPathIfNecessary(projectDirectoryPath);
    }

    private getFilePath(sourceUri: Uri) {
        return this.formatPathIfNecessary(sourceUri.fsPath);
    }

    public async initPreview(
        sourceUri: vscode.Uri,
        editor: vscode.TextEditor,
        viewOptions: { viewColumn: vscode.ViewColumn; preserveFocus?: boolean }
    ) {
        const isUsingSinglePreview = useSinglePreview();
        let previewPanel: vscode.WebviewPanel;
        if (isUsingSinglePreview && this.singlePreviewPanel) {
            const oldResourceRoot =
                this.getProjectDirectoryPath(
                    this.singlePreviewPanelSourceUriTarget!,
                    vscode.workspace.workspaceFolders
                ) ||
                path.dirname(this.singlePreviewPanelSourceUriTarget!.fsPath);
            const newResourceRoot =
                this.getProjectDirectoryPath(
                    sourceUri,
                    vscode.workspace.workspaceFolders
                ) || path.dirname(sourceUri.fsPath);

            if (oldResourceRoot !== newResourceRoot) {
                this.singlePreviewPanel.dispose();
                this.initPreview(sourceUri, editor, viewOptions);
                return;
            } else {
                previewPanel = this.singlePreviewPanel;
                this.singlePreviewPanelSourceUriTarget = sourceUri;
            }
        } else if (this.previewMaps[sourceUri.fsPath]) {
            previewPanel = this.previewMaps[sourceUri.fsPath];
        } else {
            previewPanel = vscode.window.createWebviewPanel(
                "markdown-slide",
                `Preview ${path.basename(sourceUri.fsPath)}`,
                viewOptions,
                {
                    enableFindWidget: true,
                    enableScripts: true, // TODO: This might be set by enableScriptExecution config. But for now we just enable it.
                }
            );
            previewPanel.iconPath = vscode.Uri.file(
                path.join(this.context.extensionPath, "media", "preview.svg")
            );

            // register previewPanel message events
            previewPanel.webview.onDidReceiveMessage(
                (message) => {
                },
                null,
                this.context.subscriptions
            );

            // unregister previewPanel
            previewPanel.onDidDispose(
                () => {
                    this.destroyPreview(sourceUri);
                },
                null,
                this.context.subscriptions
            );

            if (isUsingSinglePreview) {
                this.singlePreviewPanel = previewPanel;
                this.singlePreviewPanelSourceUriTarget = sourceUri;
            }
        }

        // register previewPanel
        this.previewMaps[sourceUri.fsPath] = previewPanel;
        this.preview2EditorMap.set(previewPanel, editor);

        // set title
        previewPanel.title = `Preview ${path.basename(sourceUri.fsPath)}`;

        // init markdown engine
        let initialLine: number | undefined;
        if (editor && editor.document.uri.fsPath === sourceUri.fsPath) {
            initialLine = await new Promise((resolve, reject) => {
                // Hack: sometimes we only get 0. I couldn't find API to wait for editor getting loaded.
                setTimeout(() => {
                    return resolve(editor.selections[0].active.line || 0);
                }, 100);
            });
        }

        // render
        previewPanel.webview.html = getWebviewContent(this.context);
        sendMessageToPanel(previewPanel, 'content', editor.document.getText())
    }

    /**
     * Close all previews
     */
    public closeAllPreviews(singlePreview: boolean) {
        if (singlePreview) {
            if (this.singlePreviewPanel) {
                this.singlePreviewPanel.dispose();
            }
        } else {
            const previewPanels = [];
            for (const key in this.previewMaps) {
                if (this.previewMaps.hasOwnProperty(key)) {
                    const previewPanel = this.previewMaps[key];
                    if (previewPanel) {
                        previewPanels.push(previewPanel);
                    }
                }
            }

            previewPanels.forEach((previewPanel) => previewPanel.dispose());
        }

        this.previewMaps = {};
        this.preview2EditorMap = new Map();
        this.singlePreviewPanel = null;
        this.singlePreviewPanelSourceUriTarget = null;
    }

    public previewPostMessage(sourceUri: Uri, message: any) {
        const preview = this.getPreview(sourceUri);
        if (preview) {
            preview.webview.postMessage(message);
        }
    }

    public previewHasTheSameSingleSourceUri(sourceUri: Uri) {
        if (!this.singlePreviewPanelSourceUriTarget) {
            return false;
        } else {
            return (
                this.singlePreviewPanelSourceUriTarget.fsPath ===
                sourceUri.fsPath
            );
        }
    }

    public updateMarkdown(sourceUri: Uri, triggeredBySave?: boolean) {
        const previewPanel = this.getPreview(sourceUri);
        if (!previewPanel) {
            return;
        }

        vscode.workspace.openTextDocument(sourceUri).then((document) => {
            const text = document.getText();
            this.previewPostMessage(sourceUri, {
                command: "startParsingMarkdown",
            });
            this.refreshPreviewPanel(sourceUri);
        });
    }

    public refreshPreviewPanel(sourceUri: Uri) {
        this.preview2EditorMap.forEach((editor, previewPanel) => {
            if (
                previewPanel &&
                editor &&
                editor.document &&
                isMarkdownFile(editor.document) &&
                editor.document.uri &&
                editor.document.uri.fsPath === sourceUri.fsPath
            ) {
                this.initPreview(sourceUri, editor, {
                    viewColumn: previewPanel.viewColumn!,
                    preserveFocus: true,
                });
            }
        });
    }

    public update = _.debounce((sourceUri: Uri) => {
        if (!this.getPreview(sourceUri)) {
            return;
        }
        this.updateMarkdown(sourceUri);
    }, 300);
}

function sendMessageToPanel(panel: vscode.WebviewPanel, type: string, msg: string) {
    panel.webview.postMessage({
        command: type,
        data: msg,
    });
}

export function useSinglePreview() {
    const config = vscode.workspace.getConfiguration("markdown-slide");
    return config.get<boolean>("singlePreview");
}

export function isMarkdownFile(document: vscode.TextDocument) {
    return (
        document.languageId === "markdown" &&
        document.uri.scheme !== "markdown-slide"
    ); // prevent processing of own documents
}