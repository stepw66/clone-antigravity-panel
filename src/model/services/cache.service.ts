/**
 * CacheService: Manages brain tasks and code contexts
 * 
 * Implements ICacheService interface for dependency injection.
 * Responsible for scanning and cleaning ~/.gemini/antigravity/brain/ and conversations/ directories.
 */

import * as fs from 'fs';
import * as path from 'path';
import { getBrainDir, getConversationsDir, getCodeContextsDir } from '../../shared/utils/paths';
import type { ICacheService } from './interfaces';
import type { BrainTask, CacheInfo, CodeContext, FileItem } from '../types/entities';

// Re-export types for backward compatibility
export type { BrainTask, CacheInfo };

/**
 * CacheService implementation
 */
export class CacheService implements ICacheService {
    private baseBrainDir: string;
    private baseConversationsDir: string;
    private baseCodeContextsDir: string;

    constructor(brainDir?: string, conversationsDir?: string, codeContextsDir?: string) {
        this.baseBrainDir = brainDir || getBrainDir();
        this.baseConversationsDir = conversationsDir || getConversationsDir();
        this.baseCodeContextsDir = codeContextsDir || getCodeContextsDir();
    }

    // ==================== ICacheService Implementation ====================

    /**
     * Get comprehensive cache information including sizes and task list
     */
    async getCacheInfo(): Promise<CacheInfo> {
        const [brainSize, conversationsSize, brainTasks, codeContexts, conversationsCount] =
            await Promise.all([
                this.getDirectorySize(this.baseBrainDir),
                this.getDirectorySize(this.baseConversationsDir),
                this.getBrainTasks(),
                this.getCodeContexts(),
                this.getFileCount(this.baseConversationsDir),
            ]);

        return {
            brainSize,
            conversationsSize,
            totalSize: brainSize + conversationsSize,
            brainCount: brainTasks.length,
            conversationsCount,
            brainTasks,
            codeContexts,
        };
    }

    /**
     * Get list of brain tasks
     */
    async getBrainTasks(): Promise<BrainTask[]> {
        try {
            const entries = await fs.promises.readdir(this.baseBrainDir, { withFileTypes: true });
            const tasks: BrainTask[] = [];

            for (const entry of entries) {
                if (!entry.isDirectory()) continue;

                const taskPath = path.join(this.baseBrainDir, entry.name);
                const [size, fileCount, label, stat] = await Promise.all([
                    this.getDirectorySize(taskPath),
                    this.getFileCount(taskPath),
                    this.getTaskLabel(taskPath, entry.name),
                    fs.promises.stat(taskPath),
                ]);

                tasks.push({
                    id: entry.name,
                    label,
                    path: taskPath,
                    size,
                    fileCount,
                    createdAt: stat.birthtimeMs || stat.mtimeMs,
                });
            }

            // Sort by creation time descending (newest first)
            return tasks.sort((a, b) => b.createdAt - a.createdAt);
        } catch {
            return [];
        }
    }

    /**
     * Get list of code contexts (projects)
     */
    async getCodeContexts(): Promise<CodeContext[]> {
        try {
            const entries = await fs.promises.readdir(this.baseCodeContextsDir, { withFileTypes: true });
            const contexts: CodeContext[] = [];

            for (const entry of entries) {
                if (!entry.isDirectory()) continue;

                const contextPath = path.join(this.baseCodeContextsDir, entry.name);
                const size = await this.getDirectorySize(contextPath);

                contexts.push({
                    id: entry.name,
                    name: entry.name,
                    size,
                });
            }

            // Sort by name for consistent display
            return contexts.sort((a, b) => a.name.localeCompare(b.name));
        } catch {
            return [];
        }
    }

    /**
     * Get files within a brain task
     */
    async getTaskFiles(taskId: string): Promise<FileItem[]> {
        const taskPath = path.join(this.baseBrainDir, taskId);
        return this.getFilesInDirectory(taskPath);
    }

    /**
     * Get files within a code context
     */
    async getContextFiles(contextId: string): Promise<FileItem[]> {
        const contextPath = path.join(this.baseCodeContextsDir, contextId);
        return this.getFilesInDirectory(contextPath);
    }

    /**
     * Delete a brain task
     */
    async deleteTask(taskId: string): Promise<void> {
        const taskPath = path.join(this.baseBrainDir, taskId);
        await fs.promises.rm(taskPath, { recursive: true, force: true });

        // Also delete corresponding conversation file
        const conversationFile = path.join(this.baseConversationsDir, `${taskId}.pb`);
        await fs.promises.rm(conversationFile, { force: true }).catch(() => { });
    }

    /**
     * Delete a code context
     */
    async deleteContext(contextId: string): Promise<void> {
        const contextPath = path.join(this.baseCodeContextsDir, contextId);
        await fs.promises.rm(contextPath, { recursive: true, force: true });
    }

    /**
     * Delete a single file
     */
    async deleteFile(filePath: string): Promise<void> {
        await fs.promises.rm(filePath, { force: true });
    }

    /**
     * Clean cache by removing old tasks
     * @param keepCount Number of newest tasks to keep (default: 5)
     * @returns Object containing number of tasks deleted and total bytes freed
     */
    async cleanCache(keepCount: number = 5): Promise<{ deletedCount: number, freedBytes: number }> {
        try {
            let deletedCount = 0;
            let freedBytes = 0;

            // 1. Clean Brain Task Directories
            const tasks = await this.getBrainTasks(); // Already sorted by mtime descending
            if (tasks.length > keepCount) {
                const tasksToDelete = tasks.slice(keepCount);
                for (const task of tasksToDelete) {
                    freedBytes += task.size;
                    // Also check for the .pb file size before deleteTask removes it
                    const pbPath = path.join(this.baseConversationsDir, `${task.id}.pb`);
                    try {
                        const pbStat = await fs.promises.stat(pbPath);
                        freedBytes += pbStat.size;
                    } catch { /* ignore if not exists */ }

                    await this.deleteTask(task.id);
                    deletedCount++;
                }
            }

            // 2. Clean Orphan Conversation Files (.pb) 
            // In case some folders were deleted but .pb files remain
            try {
                const pbFiles = await fs.promises.readdir(this.baseConversationsDir, { withFileTypes: true });
                const pbItems = [];
                for (const file of pbFiles) {
                    if (file.isFile() && file.name.endsWith('.pb')) {
                        const filePath = path.join(this.baseConversationsDir, file.name);
                        const stat = await fs.promises.stat(filePath);
                        pbItems.push({ name: file.name, path: filePath, mtime: stat.mtimeMs, size: stat.size });
                    }
                }

                // Sort by mtime descending (newest first)
                pbItems.sort((a, b) => b.mtime - a.mtime);

                if (pbItems.length > keepCount) {
                    const pbToDelete = pbItems.slice(keepCount);
                    for (const item of pbToDelete) {
                        // Check if it's already deleted by the deleteTask loop above
                        try {
                            await fs.promises.access(item.path); // Check if file still exists
                            freedBytes += item.size;
                            await fs.promises.rm(item.path, { force: true });
                            // We don't increment deletedCount here as it primarily tracks brain tasks.
                            // Orphan .pb files are a secondary cleanup.
                        } catch { /* already gone or other error, ignore */ }
                    }
                }
            } catch {
                // Ignore errors reading conversations dir, e.g., if it doesn't exist
            }

            return { deletedCount, freedBytes };
        } catch (err) {
            console.error('Error during cleanCache:', err);
            return { deletedCount: 0, freedBytes: 0 };
        }
    }

    // ==================== Helper Methods ====================

    /**
     * Recursively calculate directory size (in bytes)
     */
    private async getDirectorySize(dirPath: string): Promise<number> {
        try {
            const stat = await fs.promises.stat(dirPath);
            if (!stat.isDirectory()) {
                return stat.size;
            }

            const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
            let totalSize = 0;

            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                if (entry.isDirectory()) {
                    totalSize += await this.getDirectorySize(fullPath);
                } else if (entry.isFile()) {
                    const fileStat = await fs.promises.stat(fullPath);
                    totalSize += fileStat.size;
                }
            }

            return totalSize;
        } catch {
            return 0;
        }
    }

    /**
     * Get the number of files in a directory
     */
    private async getFileCount(dirPath: string): Promise<number> {
        try {
            const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
            return entries.filter((e) => e.isFile()).length;
        } catch {
            return 0;
        }
    }

    /**
     * Extract task label from task.md file, with fallback to directory name
     */
    private async getTaskLabel(taskPath: string, fallbackId: string): Promise<string> {
        try {
            const taskMdPath = path.join(taskPath, 'task.md');
            const content = await fs.promises.readFile(taskMdPath, 'utf-8');
            // Try to extract first line as label (usually a markdown heading)
            const firstLine = content.split('\n')[0];
            if (firstLine && firstLine.startsWith('#')) {
                return firstLine.replace(/^#+\s*/, '').trim();
            }
            // If no heading found, use first 50 characters of content or just full line? 
            // Usually filenames/first lines are okay to display fully.
            const text = content.trim().split('\n')[0];
            return text || fallbackId;
        } catch {
            return fallbackId;
        }
    }

    /**
     * Get list of files in a directory
     */
    private async getFilesInDirectory(dirPath: string): Promise<FileItem[]> {
        try {
            const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
            return entries
                .filter(e => e.isFile())
                .map(e => ({
                    name: e.name,
                    path: path.join(dirPath, e.name),
                }));
        } catch {
            return [];
        }
    }

    /**
     * Get the brain directory path
     */
    getBrainDirPath(): string {
        return this.baseBrainDir;
    }

    /**
     * Get total cache size in bytes (simplified interface)
     */
    async getCurrentSize(): Promise<number> {
        const info = await this.getCacheInfo();
        return info.totalSize;
    }

    /**
     * Legacy method for backward compatibility
     */
    async clean(): Promise<{ deletedCount: number, freedBytes: number }> {
        return this.cleanCache(5);
    }
}

// Backward compatibility: Re-export as CacheManager
export { CacheService as CacheManager };
