/**
 * SidebarFooter - Footer component with recovery actions and links (Light DOM)
 */

import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { VsCodeApi, WindowWithVsCode } from '../types.js';

/** GitHub repository URLs */
const GITHUB_ISSUES_URL = 'https://github.com/n2ns/antigravity-panel/issues';
const GITHUB_HOME_URL = 'https://github.com/n2ns/antigravity-panel';

@customElement('sidebar-footer')
export class SidebarFooter extends LitElement {
  // Light DOM mode
  createRenderRoot() { return this; }

  private get _vscode(): VsCodeApi | undefined {
    return (window as unknown as WindowWithVsCode).vscodeApi;
  }

  private get _t() {
    return (window as unknown as WindowWithVsCode).__TRANSLATIONS__ || {};
  }

  private _postMessage(type: string): void {
    this._vscode?.postMessage({ type });
  }

  private _openUrl(url: string): void {
    this._vscode?.postMessage({ type: 'openUrl', path: url });
  }

  protected render() {
    return html`
      <div class="recovery-actions">
        <button class="recovery-btn primary" 
                @click=${() => this._postMessage('restartLanguageServer')} 
                data-tooltip="${this._t.restartServiceTooltip || 'Restart the background Agent language server (use when code analysis is stuck)'}">
          <i class="codicon codicon-sync"></i>
          <span>${this._t.restartService || 'Restart Service'}</span>
        </button>
        <button class="recovery-btn primary" 
                @click=${() => this._postMessage('restartUserStatusUpdater')} 
                data-tooltip="${this._t.resetStatusTooltip || 'Reset user subscription and quota refresh status (use when quota display is not updating)'}">
          <i class="codicon codicon-refresh"></i>
          <span>${this._t.resetStatus || 'Reset Status'}</span>
        </button>
      </div>

      <div class="sidebar-footer">
        <button class="discussions-btn" 
                @click=${() => this._openUrl(GITHUB_ISSUES_URL)}>
          <i class="codicon codicon-bug"></i>
          <span>${this._t.reportIssue || 'Feedback'}</span>
        </button>
        <button class="discussions-btn" 
                @click=${() => this._openUrl(GITHUB_HOME_URL)}>
          <i class="codicon codicon-star-full" style="color: #e3b341;"></i>
          <span>${this._t.giveStar || 'Star'}</span>
        </button>
      </div>

      <div class="sidebar-tagline">For Antigravity. By Antigravity.</div>
    `;
  }
}

