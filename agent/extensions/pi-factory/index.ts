/**
 * Pi Factory
 *
 * Pi-native GSD + Superpowers + GStack automation.
 * Global install path: ~/.pi/agent/extensions/pi-factory/index.ts
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import type { Message } from "@mariozechner/pi-ai";
import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext, Theme } from "@mariozechner/pi-coding-agent";
import type { Component } from "@mariozechner/pi-tui";
import { Key, matchesKey, truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import { Type } from "typebox";

const FACTORY_DIR = ".pi-factory";
const PHASES_DIR = "phases";
const DECISIONS_DIR = "decisions";
const RUNS_DIR = "runs";
const SKETCHES_DIR = "sketches";
const UI_REVIEW_SCREENSHOT_DIR = "screenshots";
const DEFAULT_VERIFY_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_CHILD_TIMEOUT_MS = 20 * 60 * 1000;
const DEFAULT_CHILD_IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_MAX_AGENT_TURNS = 20;
const DEFAULT_MAX_PHASES = 1;
const MAX_RETRIES_DEFAULT = 0;

type PhaseStatus = "pending" | "context-ready" | "planned" | "running" | "blocked" | "failed" | "verified" | "done";

interface PhaseInfo {
	id: number;
	slug: string;
	name: string;
	dir: string;
	planPath: string;
	contextPath: string;
	summaryPath: string;
	verificationPath: string;
	donePath: string;
	contractPath: string;
	status: PhaseStatus;
	hasPlan: boolean;
	hasContext: boolean;
}

interface ParsedArgs {
	positionals: string[];
	flags: Record<string, string | boolean>;
}

interface RunPiResult {
	exitCode: number;
	stdout: string;
	stderr: string;
	messages: Message[];
	finalOutput: string;
	usage: {
		input: number;
		output: number;
		cacheRead: number;
		cacheWrite: number;
		cost: number;
		contextTokens: number;
		turns: number;
	};
	stopReason?: string;
	errorMessage?: string;
}

interface VerificationStep {
	command: string;
	optional: boolean;
	source: string;
	timeoutMs?: number;
	skipIfMissingNpmScript?: string;
}

interface VerificationResult {
	command: string;
	code: number;
	stdout: string;
	stderr: string;
	optional?: boolean;
	skipped?: boolean;
	reason?: string;
	timeoutMs?: number;
}

interface FactoryConfig {
	version?: number;
	verifyCommand?: string;
	childTimeoutMs?: number;
	childIdleTimeoutMs?: number;
	verifyTimeoutMs?: number;
	maxRetries?: number;
	checkpoint?: boolean;
	stopOnFailure?: boolean;
	allowDirtyStart?: boolean;
	defaultChildTools?: string;
	protectedPaths?: string[];
	maxChangedFiles?: number;
	maxDiffLines?: number;
	requireCheck?: boolean;
	maxAgentTurns?: number;
}

interface EffectiveBuildOptions {
	maxPhases: number;
	verifyCommand?: string;
	dryRun: boolean;
	noCheckpoint: boolean;
	continueOnFailure: boolean;
	maxRetries: number;
	childTimeoutMs: number;
	childIdleTimeoutMs?: number;
	verifyTimeoutMs: number;
	childTools: string;
	maxAgentTurns: number;
	requireCheck: boolean;
	allowDirtyStart: boolean;
	protectedPaths: string[];
	maxChangedFiles?: number;
	maxDiffLines?: number;
	allowProtectedChanges: boolean;
	allowLargeDiff: boolean;
	allowDangerousVerify: boolean;
}

interface CheckResult {
	phase?: PhaseInfo;
	ready: boolean;
	mustFix: string[];
	shouldFix: string[];
	verificationSteps: VerificationStep[];
}

interface DoneProtocol {
	status?: string;
	changedFiles?: string[];
	verificationAttempted?: boolean;
	readyForParentVerification?: boolean;
	notes?: string;
}

interface LoopRunRecord {
	startedAt: string;
	endedAt?: string;
	cwd: string;
	args: string;
	maxPhases: number;
	verifyCommand?: string;
	dryRun: boolean;
	effectiveOptions?: EffectiveBuildOptions;
	phases: Array<{
		id: number;
		name: string;
		slug: string;
		status: string;
		attempts: number;
		childExitCode?: number;
		verificationExitCode?: number;
		summaryPath?: string;
		verificationPath?: string;
		error?: string;
	}>;
}

function nowIso(): string {
	return new Date().toISOString();
}

function timestampForFile(date = new Date()): string {
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function slugify(input: string): string {
	const slug = input
		.toLowerCase()
		.replace(/[`'"“”‘’]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 60);
	return slug || "phase";
}

function parseArgs(args: string): ParsedArgs {
	const tokens = args.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map((t) => {
		if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1);
		return t;
	}) ?? [];
	const positionals: string[] = [];
	const flags: Record<string, string | boolean> = {};
	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i];
		if (!token.startsWith("--")) {
			positionals.push(token);
			continue;
		}
		const eq = token.indexOf("=");
		if (eq > 2) {
			flags[token.slice(2, eq)] = token.slice(eq + 1);
			continue;
		}
		const name = token.slice(2);
		const next = tokens[i + 1];
		if (next && !next.startsWith("--")) {
			flags[name] = next;
			i++;
		} else {
			flags[name] = true;
		}
	}
	return { positionals, flags };
}

function flagString(parsed: ParsedArgs, name: string): string | undefined {
	const v = parsed.flags[name];
	if (typeof v === "string") return v;
	return undefined;
}

function flagNumber(parsed: ParsedArgs, name: string, fallback: number): number {
	const raw = flagString(parsed, name);
	if (!raw) return fallback;
	const n = Number(raw);
	return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function flagNumberOptional(parsed: ParsedArgs, name: string): number | undefined {
	const raw = flagString(parsed, name);
	if (!raw) return undefined;
	const n = Number(raw);
	return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function hasFlag(parsed: ParsedArgs, name: string): boolean {
	return parsed.flags[name] === true || typeof parsed.flags[name] === "string";
}

function flagBoolWithConfig(parsed: ParsedArgs, name: string, configValue: boolean | undefined, fallback: boolean): boolean {
	if (hasFlag(parsed, name)) return true;
	return configValue ?? fallback;
}

function flagNumberWithConfig(parsed: ParsedArgs, name: string, configValue: number | undefined, fallback: number): number {
	const explicit = flagNumberOptional(parsed, name);
	return explicit ?? configValue ?? fallback;
}

function flagStringWithConfig(parsed: ParsedArgs, name: string, configValue: string | undefined): string | undefined {
	return flagString(parsed, name) ?? configValue;
}

function ensureDir(dir: string): void {
	fs.mkdirSync(dir, { recursive: true });
}

function writeIfMissing(filePath: string, content: string): boolean {
	if (fs.existsSync(filePath)) return false;
	ensureDir(path.dirname(filePath));
	fs.writeFileSync(filePath, content, "utf-8");
	return true;
}

function appendFile(filePath: string, content: string): void {
	ensureDir(path.dirname(filePath));
	fs.appendFileSync(filePath, content, "utf-8");
}

function writeJson(filePath: string, data: unknown): void {
	ensureDir(path.dirname(filePath));
	fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

function readText(filePath: string): string {
	return fs.readFileSync(filePath, "utf-8");
}

function readJsonFile<T>(filePath: string): T {
	return JSON.parse(readText(filePath)) as T;
}

function exists(filePath: string): boolean {
	return fs.existsSync(filePath);
}

function factoryPath(cwd: string, ...parts: string[]): string {
	return path.join(cwd, FACTORY_DIR, ...parts);
}

function defaultConfig(): FactoryConfig {
	return {
		version: 3,
		verifyCommand: "",
		childTimeoutMs: DEFAULT_CHILD_TIMEOUT_MS,
		childIdleTimeoutMs: DEFAULT_CHILD_IDLE_TIMEOUT_MS,
		verifyTimeoutMs: DEFAULT_VERIFY_TIMEOUT_MS,
		maxRetries: MAX_RETRIES_DEFAULT,
		checkpoint: true,
		stopOnFailure: true,
		allowDirtyStart: true,
		defaultChildTools: "read,bash,edit,write",
		maxAgentTurns: DEFAULT_MAX_AGENT_TURNS,
		protectedPaths: [".env", ".env.*", ".git/**", "node_modules/**", "dist/**", "build/**"],
		maxChangedFiles: 40,
		maxDiffLines: 2000,
		requireCheck: true,
	};
}

function loadConfig(cwd: string): { config: FactoryConfig; error?: string } {
	const configPath = factoryPath(cwd, "config.json");
	if (!exists(configPath)) return { config: defaultConfig() };
	try {
		const parsed = readJsonFile<FactoryConfig>(configPath);
		return { config: { ...defaultConfig(), ...parsed } };
	} catch (err) {
		return { config: defaultConfig(), error: `Invalid ${path.relative(cwd, configPath)}: ${err instanceof Error ? err.message : String(err)}` };
	}
}

function cleanConfigVerifyCommand(command: string | undefined): string | undefined {
	const trimmed = command?.trim();
	return trimmed ? trimmed : undefined;
}

function buildEffectiveOptions(parsed: ParsedArgs, config: FactoryConfig): EffectiveBuildOptions {
	const maxPhases = flagNumberOptional(parsed, "max-phases") ?? flagNumberOptional(parsed, "max") ?? DEFAULT_MAX_PHASES;
	const verifyCommand = cleanConfigVerifyCommand(flagStringWithConfig(parsed, "verify", config.verifyCommand));
	const checkpointEnabled = config.checkpoint ?? true;
	const stopOnFailure = config.stopOnFailure ?? true;
	return {
		maxPhases,
		verifyCommand,
		dryRun: hasFlag(parsed, "dry-run"),
		noCheckpoint: hasFlag(parsed, "no-checkpoint") || !checkpointEnabled,
		continueOnFailure: hasFlag(parsed, "continue-on-failure") || !stopOnFailure,
		maxRetries: flagNumberWithConfig(parsed, "retries", config.maxRetries, MAX_RETRIES_DEFAULT),
		childTimeoutMs: flagNumberWithConfig(parsed, "child-timeout-ms", config.childTimeoutMs, DEFAULT_CHILD_TIMEOUT_MS),
		childIdleTimeoutMs: flagNumberWithConfig(parsed, "child-idle-timeout-ms", config.childIdleTimeoutMs, DEFAULT_CHILD_IDLE_TIMEOUT_MS),
		verifyTimeoutMs: flagNumberWithConfig(parsed, "verify-timeout-ms", config.verifyTimeoutMs, DEFAULT_VERIFY_TIMEOUT_MS),
		childTools: flagString(parsed, "tools") ?? config.defaultChildTools ?? "read,bash,edit,write",
		maxAgentTurns: flagNumberWithConfig(parsed, "max-agent-turns", config.maxAgentTurns, DEFAULT_MAX_AGENT_TURNS),
		requireCheck: flagBoolWithConfig(parsed, "require-check", config.requireCheck, false),
		allowDirtyStart: hasFlag(parsed, "allow-dirty-start") || (config.allowDirtyStart ?? true),
		protectedPaths: config.protectedPaths ?? [],
		maxChangedFiles: flagNumberOptional(parsed, "max-changed-files") ?? config.maxChangedFiles,
		maxDiffLines: flagNumberOptional(parsed, "max-diff-lines") ?? config.maxDiffLines,
		allowProtectedChanges: hasFlag(parsed, "allow-protected-changes"),
		allowLargeDiff: hasFlag(parsed, "allow-large-diff"),
		allowDangerousVerify: hasFlag(parsed, "allow-dangerous-verify"),
	};
}

function getPiInvocation(args: string[]): { command: string; args: string[] } {
	const currentScript = process.argv[1];
	const isBunVirtualScript = currentScript?.startsWith("/$bunfs/root/");
	if (currentScript && !isBunVirtualScript && fs.existsSync(currentScript)) {
		return { command: process.execPath, args: [currentScript, ...args] };
	}

	const execName = path.basename(process.execPath).toLowerCase();
	const isGenericRuntime = /^(node|bun)(\.exe)?$/.test(execName);
	if (!isGenericRuntime) return { command: process.execPath, args };
	return { command: "pi", args };
}

function getFinalOutput(messages: Message[]): string {
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i];
		if (msg.role !== "assistant") continue;
		for (const part of msg.content) {
			if (part.type === "text") return part.text;
		}
	}
	return "";
}

async function runCommand(pi: ExtensionAPI, cwd: string, command: string, timeout = DEFAULT_VERIFY_TIMEOUT_MS) {
	const result = await pi.exec("bash", ["-lc", command], { cwd, timeout });
	return result;
}

async function isGitRepo(pi: ExtensionAPI, cwd: string): Promise<boolean> {
	const result = await runCommand(pi, cwd, "git rev-parse --is-inside-work-tree", 20_000).catch(() => undefined);
	return result?.code === 0 && result.stdout.trim() === "true";
}

async function getGitStatus(pi: ExtensionAPI, cwd: string): Promise<string> {
	if (!(await isGitRepo(pi, cwd))) return "not a git repository";
	const result = await runCommand(pi, cwd, "git status --short", 30_000).catch((err) => ({ stdout: "", stderr: String(err), code: 1 }));
	return `${result.stdout}${result.stderr ? `\nSTDERR:\n${result.stderr}` : ""}`.trim();
}

async function getGitChangedFiles(pi: ExtensionAPI, cwd: string): Promise<string[]> {
	if (!(await isGitRepo(pi, cwd))) return [];
	const result = await runCommand(pi, cwd, "git status --short --untracked-files=all", 30_000).catch(() => ({ stdout: "", stderr: "", code: 1 }));
	if (result.code !== 0) return [];
	return result.stdout
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => line.replace(/^..\s+/, "").replace(/^(.+) -> (.+)$/, "$2"));
}

async function getGitDiffLineCount(pi: ExtensionAPI, cwd: string): Promise<number> {
	if (!(await isGitRepo(pi, cwd))) return 0;
	const result = await runCommand(pi, cwd, "git diff --numstat && git diff --cached --numstat", 30_000).catch(() => ({ stdout: "", stderr: "", code: 1 }));
	if (result.code !== 0) return 0;
	return result.stdout
		.split(/\r?\n/)
		.map((line) => line.trim().split(/\s+/).slice(0, 2))
		.reduce((sum, [add, del]) => sum + (Number(add) || 0) + (Number(del) || 0), 0);
}

async function gitCheckpoint(pi: ExtensionAPI, cwd: string, message: string): Promise<{ ok: boolean; output: string }> {
	if (!(await isGitRepo(pi, cwd))) return { ok: false, output: "Not a git repository; skipped checkpoint." };
	const status = await getGitStatus(pi, cwd);
	if (!status.trim()) return { ok: true, output: "No git changes; skipped checkpoint commit." };
	const add = await runCommand(pi, cwd, "git add -A", 60_000);
	if (add.code !== 0) return { ok: false, output: `git add failed\n${add.stdout}\n${add.stderr}` };
	const commit = await runCommand(pi, cwd, `git commit -m ${JSON.stringify(message)}`, 120_000);
	return { ok: commit.code === 0, output: `${commit.stdout}\n${commit.stderr}`.trim() };
}

function escapeRegExp(input: string): string {
	return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function maybeStatus(raw: string): PhaseStatus | undefined {
	const s = raw.toLowerCase().trim();
	if (["pending", "context-ready", "planned", "running", "blocked", "failed", "verified", "done"].includes(s)) return s as PhaseStatus;
	return undefined;
}

function parsePhaseStatus(content: string, id: number, slug: string): PhaseStatus {
	const phaseId = String(id).padStart(2, "0");
	const phaseRef = new RegExp(`\\bPhase\\s+0*${id}\\b`, "i");
	const slugRef = new RegExp(`\\b${escapeRegExp(slug)}\\b`, "i");
	const logStatuses: PhaseStatus[] = [];
	const tableStatuses: PhaseStatus[] = [];

	for (const line of content.split(/\r?\n/)) {
		const statusMatch = line.match(/\bstatus\s*[:=]\s*([a-z-]+)/i);
		if (statusMatch && (phaseRef.test(line) || slugRef.test(line))) {
			logStatuses.push(normalizeStatus(statusMatch[1]));
			continue;
		}

		if (!/^\s*\|/.test(line)) continue;
		const cells = line
			.split("|")
			.slice(1, -1)
			.map((cell) => cell.trim());
		if (cells.length < 3) continue;
		const cellId = cells[0].replace(/^0+/, "") || "0";
		if (cellId !== String(id) && cells[0] !== phaseId) continue;
		const status = maybeStatus(cells[2]);
		if (status) tableStatuses.push(status);
	}

	return logStatuses.at(-1) ?? tableStatuses.at(-1) ?? "pending";
}

function normalizeStatus(raw: string): PhaseStatus {
	const s = raw.toLowerCase().trim();
	if (["pending", "context-ready", "planned", "running", "blocked", "failed", "verified", "done"].includes(s)) {
		return s as PhaseStatus;
	}
	if (s.includes("done")) return "done";
	if (s.includes("verified")) return "verified";
	if (s.includes("fail")) return "failed";
	if (s.includes("block")) return "blocked";
	if (s.includes("run")) return "running";
	if (s.includes("plan")) return "planned";
	return "pending";
}

function doneProtocolVeto(done?: DoneProtocol): { status: PhaseStatus; reason: string } | undefined {
	if (!done) return undefined;
	const rawStatus = String(done.status ?? "").toLowerCase().trim();
	if (rawStatus.includes("fail")) return { status: "failed", reason: done.notes || "DONE.json status is failed." };
	if (rawStatus.includes("block")) return { status: "blocked", reason: done.notes || "DONE.json status is blocked." };
	if (done.readyForParentVerification === false) {
		return { status: "blocked", reason: done.notes || "DONE.json readyForParentVerification is false." };
	}
	return undefined;
}

function readDoneProtocolPath(donePath: string): DoneProtocol | undefined {
	if (!exists(donePath)) return undefined;
	try {
		return readJsonFile<DoneProtocol>(donePath);
	} catch {
		return { status: "invalid-json", readyForParentVerification: false, verificationAttempted: false, notes: "DONE.json is invalid JSON." };
	}
}

function discoverPhases(cwd: string): PhaseInfo[] {
	const phasesRoot = factoryPath(cwd, PHASES_DIR);
	if (!fs.existsSync(phasesRoot)) return [];
	const statePath = factoryPath(cwd, "STATE.md");
	const roadmapPath = factoryPath(cwd, "ROADMAP.md");
	const state = exists(statePath) ? readText(statePath) : "";
	const roadmap = exists(roadmapPath) ? readText(roadmapPath) : "";
	const statusText = `${state}\n${roadmap}`;

	return fs
		.readdirSync(phasesRoot, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => {
			const match = entry.name.match(/^(\d+)[-_](.+)$/);
			const id = match ? Number(match[1]) : 9999;
			const slug = match ? match[2] : entry.name;
			const name = slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
			const dir = path.join(phasesRoot, entry.name);
			const planPath = path.join(dir, "PLAN.md");
			const contextPath = path.join(dir, "CONTEXT.md");
			const summaryPath = path.join(dir, "SUMMARY.md");
			const verificationPath = path.join(dir, "VERIFICATION.md");
			const donePath = path.join(dir, "DONE.json");
			const contractPath = path.join(dir, "phase.json");
			const statusFromFiles = parsePhaseStatus(statusText, id, slug);
			let status: PhaseStatus = statusFromFiles;
			if (exists(verificationPath) && readText(verificationPath).match(/status\s*:\s*(verified|done)/i)) status = "verified";
			if (exists(summaryPath) && readText(summaryPath).match(/status\s*:\s*done/i)) status = "done";
			const veto = doneProtocolVeto(readDoneProtocolPath(donePath));
			if (veto) status = veto.status;
			if (status === "pending" && exists(planPath)) status = "planned";
			if (status === "pending" && exists(contextPath)) status = "context-ready";
			return {
				id,
				slug,
				name,
				dir,
				planPath,
				contextPath,
				summaryPath,
				verificationPath,
				donePath,
				contractPath,
				status,
				hasPlan: exists(planPath),
				hasContext: exists(contextPath),
			};
		})
		.sort((a, b) => a.id - b.id || a.slug.localeCompare(b.slug));
}

function findPhase(cwd: string, raw?: string): PhaseInfo | undefined {
	const phases = discoverPhases(cwd);
	if (!raw) return phases.find((p) => p.hasPlan && !["done", "verified"].includes(p.status));
	const n = Number(raw);
	if (Number.isFinite(n)) return phases.find((p) => p.id === n);
	const slug = slugify(raw);
	return phases.find((p) => p.slug === raw || p.slug === slug || p.name.toLowerCase() === raw.toLowerCase());
}

function updateState(cwd: string, phase: PhaseInfo, status: PhaseStatus, note?: string): void {
	const statePath = factoryPath(cwd, "STATE.md");
	const line = `- ${nowIso()} — Phase ${String(phase.id).padStart(2, "0")} ${phase.slug} status: ${status}${note ? ` — ${note}` : ""}\n`;
	if (!exists(statePath)) {
		writeIfMissing(
			statePath,
			`# Pi Factory State\n\n## Current status\n\n${line}\n## Log\n\n`,
		);
		return;
	}
	appendFile(statePath, line);
}

function isOptionalVerificationLine(line: string): boolean {
	return /\boptional\b|\brequired\s*[:=]?\s*(?:no|false)\b|\bskip(?:ped)?\b|\bif\b.*\b(?:exists?|available|present|configured)\b|\bwhen\b.*\b(?:exists?|available|present|configured)\b/i.test(line);
}

function parseBooleanish(input: string | undefined, fallback: boolean): boolean {
	if (!input) return fallback;
	if (/^(yes|true|required|mandatory)$/i.test(input.trim())) return true;
	if (/^(no|false|optional)$/i.test(input.trim())) return false;
	return fallback;
}

function parseTimeoutMs(input: string | undefined): number | undefined {
	if (!input) return undefined;
	const n = Number(input.trim());
	return Number.isFinite(n) && n > 0 ? n : undefined;
}

function addVerificationStep(steps: VerificationStep[], command: string, line: string, overrides: Partial<VerificationStep> = {}): void {
	const normalized = command.trim();
	if (!normalized || /^TBD$/i.test(normalized)) return;
	if (steps.some((step) => step.command === normalized)) return;
	steps.push({ command: normalized, optional: isOptionalVerificationLine(line), source: line.trim(), ...overrides });
}

function extractMachineReadableVerification(plan: string): VerificationStep[] {
	const steps: VerificationStep[] = [];
	const yamlBlock = plan.match(/```(?:ya?ml)\s*\n([\s\S]*?)\n```/i);
	if (!yamlBlock || !/verification\s*:/i.test(yamlBlock[1])) return steps;
	const lines = yamlBlock[1].split(/\r?\n/);
	let inVerification = false;
	let current: Partial<VerificationStep> = {};
	const flush = () => {
		if (current.command) addVerificationStep(steps, current.command, "machine-readable verification", current);
		current = {};
	};
	for (const line of lines) {
		if (/^\s*verification\s*:\s*$/.test(line)) {
			inVerification = true;
			continue;
		}
		if (inVerification && /^\S/.test(line) && !/^verification\s*:/.test(line)) {
			flush();
			inVerification = false;
		}
		if (!inVerification) continue;
		const commandStart = line.match(/^\s*-\s*command\s*:\s*(.+?)\s*$/);
		if (commandStart) {
			flush();
			current.command = commandStart[1].replace(/^['"]|['"]$/g, "");
			current.optional = false;
			current.source = line.trim();
			continue;
		}
		const prop = line.match(/^\s+(required|optional|timeoutMs|timeout|skip_if_missing_npm_script|skipIfMissingNpmScript)\s*:\s*(.+?)\s*$/);
		if (!prop) continue;
		const key = prop[1];
		const value = prop[2].replace(/^['"]|['"]$/g, "");
		if (key === "required") current.optional = !parseBooleanish(value, true);
		else if (key === "optional") current.optional = parseBooleanish(value, false);
		else if (key === "timeoutMs" || key === "timeout") current.timeoutMs = parseTimeoutMs(value);
		else current.skipIfMissingNpmScript = value;
	}
	flush();
	return steps;
}

function extractVerificationSteps(plan: string): VerificationStep[] {
	const machine = extractMachineReadableVerification(plan);
	if (machine.length) return machine;

	const lines = plan.split(/\r?\n/);
	const steps: VerificationStep[] = [];
	let inSection = false;
	let inFence = false;
	let fenceLang = "";
	for (const line of lines) {
		if (/^#{1,4}\s+/.test(line)) {
			inSection = /verification|test command/i.test(line);
			continue;
		}
		if (!inSection) continue;
		const fence = line.match(/^\s*```(\w+)?/);
		if (fence) {
			inFence = !inFence;
			fenceLang = inFence ? (fence[1] || "") : "";
			continue;
		}
		if (inFence) {
			if (!fenceLang || /^(bash|sh|shell|zsh)$/i.test(fenceLang)) addVerificationStep(steps, line, line);
			continue;
		}
		const tableCells = line.startsWith("|")
			? line
					.split("|")
					.slice(1, -1)
					.map((cell) => cell.trim())
			: [];
		if (tableCells.length >= 2 && !/^[-: ]+$/.test(tableCells.join("")) && !/^command$/i.test(tableCells[0])) {
			const cmd = tableCells[0].match(/`([^`]+)`/)?.[1] ?? tableCells[0];
			const requiredCell = tableCells[1];
			const timeoutCell = tableCells[2];
			addVerificationStep(steps, cmd, line, { optional: !parseBooleanish(requiredCell, true), timeoutMs: parseTimeoutMs(timeoutCell) });
			continue;
		}
		const code = line.match(/`([^`]+)`/);
		if (code) {
			addVerificationStep(steps, code[1], line);
			continue;
		}
		const bullet = line.match(/^\s*[-*]\s+(npm|pnpm|yarn|bun|npx|pytest|cargo|go|uv|python|make|test|grep|node)\b(.+)$/);
		if (bullet) addVerificationStep(steps, `${bullet[1]}${bullet[2]}`, line);
	}
	return steps;
}

function extractVerificationCommands(plan: string): string[] {
	return extractVerificationSteps(plan).map((step) => step.command);
}

function npmScriptFromCommand(command: string): string | undefined {
	const trimmed = command.trim();
	if (/^npm\s+test(?:\s|$)/.test(trimmed)) return "test";
	const runMatch = trimmed.match(/^npm\s+run\s+(?:--silent\s+|-s\s+)?([^\s;&|]+)/);
	if (runMatch) return runMatch[1];
	return undefined;
}

async function maybeSkipOptionalVerification(pi: ExtensionAPI, cwd: string, step: VerificationStep): Promise<VerificationResult | undefined> {
	const npmScript = step.skipIfMissingNpmScript ?? npmScriptFromCommand(step.command);
	if (!npmScript || (!step.optional && !step.skipIfMissingNpmScript)) return undefined;
	const packagePath = path.join(cwd, "package.json");
	if (!exists(packagePath)) {
		return { command: step.command, code: 0, stdout: "", stderr: "", optional: true, skipped: true, reason: "package.json not found for optional npm script check", timeoutMs: step.timeoutMs };
	}
	const scriptExists = await runCommand(
		pi,
		cwd,
		`node -e ${JSON.stringify(`const p=require('./package.json'); process.exit(p.scripts && p.scripts[${JSON.stringify(npmScript)}] ? 0 : 2);`)}`,
		30_000,
	).catch(() => ({ code: 2, stdout: "", stderr: "" }));
	if (scriptExists.code === 0) return undefined;
	return { command: step.command, code: 0, stdout: `Skipped optional verification: npm script \"${npmScript}\" is not present in package.json.\n`, stderr: "", optional: true, skipped: true, reason: `npm script \"${npmScript}\" is not present in package.json`, timeoutMs: step.timeoutMs };
}

function hasDangerousCommand(command: string): boolean {
	return /\brm\s+-rf\s+\/?(?:\s|$)|\bsudo\b|\b(curl|wget)\b[^|;]*\|\s*(?:sh|bash)|\bdd\s+if=|\bmkfs\b/i.test(command);
}

async function runPiJson(prompt: string, cwd: string, options?: { timeoutMs?: number; idleTimeoutMs?: number; tools?: string; extraArgs?: string[]; maxTurns?: number; onText?: (text: string) => void }): Promise<RunPiResult> {
	const args = ["--no-extensions", "--mode", "json", "-p", "--no-session"];
	if (options?.tools) args.push("--tools", options.tools);
	if (options?.extraArgs) args.push(...options.extraArgs);
	args.push(prompt);

	const currentResult: RunPiResult = {
		exitCode: 0,
		stdout: "",
		stderr: "",
		messages: [],
		finalOutput: "",
		usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 },
	};

	let timeoutHandle: NodeJS.Timeout | undefined;
	let idleTimeoutHandle: NodeJS.Timeout | undefined;
	let timedOut = false;
	let idleTimedOut = false;
	let turnLimitReached = false;
	const exitCode = await new Promise<number>((resolve) => {
		const invocation = getPiInvocation(args);
		const proc = spawn(invocation.command, invocation.args, { cwd, shell: false, stdio: ["ignore", "pipe", "pipe"] });
		let buffer = "";
		let exited = false;
		const stopProcess = () => {
			if (exited) return;
			proc.kill("SIGTERM");
			setTimeout(() => {
				if (!exited) proc.kill("SIGKILL");
			}, 5000);
		};
		const resetIdleTimer = () => {
			if (idleTimeoutHandle) clearTimeout(idleTimeoutHandle);
			if (options?.idleTimeoutMs && options.idleTimeoutMs > 0) {
				idleTimeoutHandle = setTimeout(() => {
					idleTimedOut = true;
					stopProcess();
				}, options.idleTimeoutMs);
			}
		};
		resetIdleTimer();

		const processLine = (line: string) => {
			resetIdleTimer();
			currentResult.stdout += `${line}\n`;
			if (!line.trim()) return;
			let event: any;
			try {
				event = JSON.parse(line);
			} catch {
				return;
			}
			if (event.type === "message_update" && event.assistantMessageEvent?.type === "text_delta") {
				const delta = event.assistantMessageEvent.delta;
				if (typeof delta === "string" && options?.onText) options.onText(delta);
			}
			if (event.type === "message_end" && event.message) {
				const msg = event.message as Message;
				currentResult.messages.push(msg);
				if (msg.role === "assistant") {
					currentResult.usage.turns++;
					if (options?.maxTurns && currentResult.usage.turns >= options.maxTurns && msg.stopReason === "toolUse") {
						turnLimitReached = true;
						currentResult.errorMessage = `Stopped after ${currentResult.usage.turns} assistant turns without final answer.`;
						stopProcess();
					}
					const usage = msg.usage;
					if (usage) {
						currentResult.usage.input += usage.input || 0;
						currentResult.usage.output += usage.output || 0;
						currentResult.usage.cacheRead += usage.cacheRead || 0;
						currentResult.usage.cacheWrite += usage.cacheWrite || 0;
						currentResult.usage.cost += usage.cost?.total || 0;
						currentResult.usage.contextTokens = usage.totalTokens || 0;
					}
					if (msg.stopReason) currentResult.stopReason = msg.stopReason;
					if (msg.errorMessage) currentResult.errorMessage = msg.errorMessage;
				}
			}
		};

		proc.stdout.on("data", (data) => {
			buffer += data.toString();
			const lines = buffer.split("\n");
			buffer = lines.pop() || "";
			for (const line of lines) processLine(line);
		});

		proc.stderr.on("data", (data) => {
			resetIdleTimer();
			currentResult.stderr += data.toString();
		});

		proc.on("close", (code) => {
			exited = true;
			if (timeoutHandle) clearTimeout(timeoutHandle);
			if (idleTimeoutHandle) clearTimeout(idleTimeoutHandle);
			if (buffer.trim()) processLine(buffer);
			resolve(timedOut || idleTimedOut ? 124 : code ?? 0);
		});

		proc.on("error", (err) => {
			currentResult.stderr += String(err);
			resolve(1);
		});

		if (options?.timeoutMs && options.timeoutMs > 0) {
			timeoutHandle = setTimeout(() => {
				timedOut = true;
				stopProcess();
			}, options.timeoutMs);
		}
	});

	currentResult.exitCode = turnLimitReached ? 124 : exitCode;
	currentResult.finalOutput = getFinalOutput(currentResult.messages);
	if (timedOut) currentResult.stderr += `\nTimed out after ${options?.timeoutMs}ms.`;
	if (idleTimedOut) currentResult.stderr += `\nIdle timed out after ${options?.idleTimeoutMs}ms.`;
	if (turnLimitReached) currentResult.stderr += `\nStopped after reaching max turns (${options?.maxTurns}).`;
	return currentResult;
}

function projectScaffold(idea: string): Record<string, string> {
	const title = idea.trim() || "Untitled Project";
	return {
		"PROJECT.md": `# ${title}\n\nCreated: ${nowIso()}\n\n## Mission\n\n${title}\n\n## Users\n\n- TBD\n\n## Non-goals\n\n- TBD\n\n## Technical context\n\n- TBD\n`,
		"REQUIREMENTS.md": `# Requirements\n\n## Problem\n\n${title}\n\n## Functional requirements\n\n- TBD\n\n## Non-functional requirements\n\n- Verification must be automated where practical.\n- Behavior changes should follow TDD.\n\n## Acceptance criteria\n\n- TBD\n`,
		"ROADMAP.md": `# Roadmap\n\n> Add phases with /pi-plan-phase or edit this file. Phase directories live in \`.pi-factory/phases/\`.\n\n| Phase | Name | Status | Notes |\n|---:|---|---|---|\n| 01 | foundation | pending | Initial scaffold; replace with concrete phase. |\n`,
		"STATE.md": `# Pi Factory State\n\nCreated: ${nowIso()}\n\n## Current status\n\n- Project initialized.\n\n## Log\n\n`,
		"config.json": `${JSON.stringify(defaultConfig(), null, 2)}\n`,
	};
}

function ensureFactory(cwd: string, idea = ""): string[] {
	const root = factoryPath(cwd);
	ensureDir(root);
	ensureDir(factoryPath(cwd, PHASES_DIR));
	ensureDir(factoryPath(cwd, DECISIONS_DIR));
	ensureDir(factoryPath(cwd, RUNS_DIR));
	ensureDir(factoryPath(cwd, SKETCHES_DIR));
	const created: string[] = [];
	const files = projectScaffold(idea);
	for (const [name, content] of Object.entries(files)) {
		if (writeIfMissing(factoryPath(cwd, name), content)) created.push(path.join(FACTORY_DIR, name));
	}
	return created;
}

function designScaffold(projectName: string): string {
	return `# Design System\n\nCreated: ${nowIso()}\nProject: ${projectName || "TBD"}\n\n## Product personality\n\n- Audience: TBD\n- Brand adjectives: clear, useful, trustworthy\n- Anti-goals: generic AI slop, inconsistent spacing, vague copy\n\n## Visual direction\n\n- Layout density: TBD\n- Shape language: TBD\n- Icon/illustration style: TBD\n- Motion: subtle, purposeful, never decorative-only\n\n## Typography\n\n- Display font: system default unless project has a brand font\n- Body font: system default unless project has a brand font\n- Scale: 12 / 14 / 16 / 20 / 24 / 32 / 40\n- Weights: regular, medium, semibold/bold only\n\n## Color\n\n- Dominant surface: TBD\n- Text: TBD\n- Muted: TBD\n- Primary accent: TBD\n- Success/warning/destructive: semantic use only\n- Rule: accent is reserved for primary actions and meaningful states, not every clickable element.\n\n## Spacing and layout\n\n- Base grid: 4px\n- Component padding: 8 / 12 / 16 / 24\n- Section spacing: 32 / 48 / 64\n- Max content width: TBD\n\n## Components\n\n- Buttons: primary, secondary, destructive, ghost\n- Forms: labels, help text, error text, disabled/loading states\n- Cards/panels: consistent border/radius/shadow rules\n- Navigation: active state, focus state, mobile behavior\n\n## Copywriting\n\n- CTAs should describe outcomes, not mechanics.\n- Empty states should explain what happened and what to do next.\n- Error messages should include cause, recovery, and support path where useful.\n- Avoid: Submit, OK, Click here, Something went wrong.\n\n## Accessibility\n\n- Keyboard reachable interactive controls\n- Visible focus states\n- ARIA labels for icon-only controls\n- Color contrast target: WCAG AA\n\n## Review gates\n\n- Before UI implementation: create/update phase UI-SPEC.md.\n- After UI implementation: run /pi-design-review.\n- Ship gate: all six design review pillars >= 3/4 or explicit waiver in decision record.\n`;
}

function uiSpecScaffold(phase: PhaseInfo, goal = ""): string {
	return `# UI-SPEC: Phase ${String(phase.id).padStart(2, "0")} ${phase.name}\n\nStatus: draft\nCreated: ${nowIso()}\n\n## Goal\n\n${goal || "TBD"}\n\n## Screens / routes / components affected\n\n- TBD\n\n## User flow\n\n1. TBD\n\n## Visual hierarchy\n\n- Primary focal point: TBD\n- Secondary actions: TBD\n- Information hierarchy: TBD\n- Avoid: competing CTAs, equal-weight everything, dense unlabeled controls\n\n## Typography contract\n\n- Page title: TBD\n- Section heading: TBD\n- Body text: TBD\n- Label/help/error text: TBD\n- Allowed weights: TBD\n\n## Color contract\n\n- Dominant surface: TBD\n- Primary action/accent: TBD\n- Muted/supporting UI: TBD\n- Success/warning/destructive: TBD\n- Accent usage rule: only on declared primary actions/states\n\n## Spacing / layout contract\n\n- Grid: 4px base\n- Container width: TBD\n- Section spacing: TBD\n- Component padding: TBD\n- Gap rules: TBD\n\n## State contract\n\n| State | Required UX | Copy | Visual treatment |\n|---|---|---|---|\n| Loading | TBD | TBD | TBD |\n| Empty | TBD | TBD | TBD |\n| Error | TBD | TBD | TBD |\n| Success | TBD | TBD | TBD |\n| Disabled | TBD | TBD | TBD |\n\n## Responsive contract\n\n| Viewport | Expected behavior |\n|---|---|\n| Mobile 375x812 | TBD |\n| Tablet 768x1024 | TBD |\n| Desktop 1440x900 | TBD |\n\n## Accessibility contract\n\n- Keyboard: TBD\n- Focus state: TBD\n- ARIA/labels: TBD\n- Contrast: TBD\n\n## Screenshot checkpoints\n\n- Desktop: TBD route/component\n- Tablet: TBD route/component\n- Mobile: TBD route/component\n\n## Acceptance criteria\n\n- [ ] UI matches DESIGN.md or documented local exception.\n- [ ] All declared states are implemented.\n- [ ] Mobile/tablet/desktop behavior is verified.\n- [ ] No generic copy patterns remain.\n- [ ] /pi-design-review score is >= 3/4 for every pillar or waiver is recorded.\n`;
}

function createPhase(cwd: string, name: string): PhaseInfo {
	ensureFactory(cwd);
	const existing = discoverPhases(cwd);
	const id = existing.length ? Math.max(...existing.map((p) => p.id)) + 1 : 1;
	const slug = slugify(name);
	const dirName = `${String(id).padStart(2, "0")}-${slug}`;
	const dir = factoryPath(cwd, PHASES_DIR, dirName);
	ensureDir(dir);
	const phase: PhaseInfo = {
		id,
		slug,
		name,
		dir,
		planPath: path.join(dir, "PLAN.md"),
		contextPath: path.join(dir, "CONTEXT.md"),
		summaryPath: path.join(dir, "SUMMARY.md"),
		verificationPath: path.join(dir, "VERIFICATION.md"),
		donePath: path.join(dir, "DONE.json"),
		contractPath: path.join(dir, "phase.json"),
		status: "pending",
		hasPlan: false,
		hasContext: false,
	};
	writeIfMissing(phase.contextPath, `# Phase ${String(id).padStart(2, "0")}: ${name} Context\n\n## Decisions\n\n- TBD\n\n## Existing code/patterns to reuse\n\n- TBD\n\n## Design / UX context\n\n- Read \`.pi-factory/DESIGN.md\` if present.\n- If this phase touches user-facing UI, create/read \`UI-SPEC.md\` before implementation.\n- Capture visual evidence with \`/pi-design-review ${id}\` after implementation.\n\n## Open questions\n\n- TBD\n`);
	writeIfMissing(
		phase.contractPath,
		`${JSON.stringify(
			{
				version: 1,
				id,
				slug,
				name,
				status: "planned",
				verification: [],
				expectedFiles: [],
				forbiddenFiles: [],
			},
			null,
			2,
		)}\n`,
	);
	writeIfMissing(phase.planPath, `# Phase ${String(id).padStart(2, "0")}: ${name}\n\n## Objective\n\nTBD\n\n## Files to read first\n\n- \`.pi-factory/PROJECT.md\`\n- \`.pi-factory/REQUIREMENTS.md\`\n- \`.pi-factory/ROADMAP.md\`\n- \`${path.relative(cwd, phase.contextPath)}\`\n- \`.pi-factory/DESIGN.md\` if this phase touches UI/UX\n- \`${path.relative(cwd, path.join(phase.dir, "UI-SPEC.md"))}\` if this phase touches UI/UX\n\n## Assumptions / locked decisions\n\n- TBD\n\n## UI/UX contract\n\nIf this phase changes user-facing UI, run \`/pi-ui-phase ${id}\` before implementation and keep this section aligned with \`UI-SPEC.md\`.\n\n- Visual hierarchy: TBD\n- Typography: TBD\n- Color: TBD\n- Spacing/layout: TBD\n- States: loading/empty/error/success TBD\n- Responsive: mobile/tablet/desktop TBD\n- Accessibility: keyboard/ARIA/contrast TBD\n\n## Tasks\n\n1. TBD\n\n## TDD requirements\n\n- Use TDD for behavior changes.\n- For UI behavior, add component/e2e/regression tests where the project supports them.\n\n## Verification commands\n\nPrefer this machine-readable format when possible:\n\n\`\`\`yaml\nverification:\n  - command: npm test\n    required: false\n    skip_if_missing_npm_script: test\n\`\`\`\n\n## Visual verification\n\nFor user-facing UI phases:\n\n- Run \`/pi-design-review ${id}\` after implementation.\n- Required viewports: mobile 375x812, tablet 768x1024, desktop 1440x900.\n- Block ship if any UI review pillar is below 3/4 unless explicitly waived.\n\n## Done criteria\n\n- TBD\n\n## Failure handling\n\n- Stop on verification failure and update SUMMARY.md.\n`);
	appendFile(factoryPath(cwd, "ROADMAP.md"), `| ${String(id).padStart(2, "0")} | ${name} | planned | ${path.relative(cwd, dir)} |\n`);
	updateState(cwd, phase, "planned", "Phase scaffold created");
	return { ...phase, hasPlan: true, hasContext: true, status: "planned" };
}

function buildPlannerPrompt(phase: PhaseInfo, args: string): string {
	return `You are running Pi Factory phase planning. Use skills pi-gsd, pi-superpowers, and pi-gstack if available.\n\nGoal: create/update a high-quality executable PLAN.md for this phase.\n\nPhase: ${phase.id} ${phase.name}\nPhase dir: ${path.relative(process.cwd(), phase.dir)}\nUser args: ${args || "(none)"}\n\nRead these files if present:\n- .pi-factory/PROJECT.md\n- .pi-factory/REQUIREMENTS.md\n- .pi-factory/ROADMAP.md\n- .pi-factory/STATE.md\n- ${path.relative(process.cwd(), phase.contextPath)}\n\nWrite or update:\n- ${path.relative(process.cwd(), phase.planPath)}\n- ${path.relative(process.cwd(), phase.contractPath)}\n\nPLAN.md must include Objective, Files to read first, Assumptions/locked decisions, Tasks, TDD requirements, Verification commands, Done criteria, Failure handling.\n\nFor Verification commands, prefer a machine-readable block:\n\n\`\`\`yaml\nverification:\n  - command: npm test\n    required: false\n    skip_if_missing_npm_script: test\n  - command: npm run build\n    required: true\n    timeoutMs: 600000\n\`\`\`\n\nKeep language concrete; avoid ambiguous conditions like "if practical" unless encoded as required:false. Do not implement production code. Planning only. If details are missing, make explicit assumptions and list open questions.`;
}

function buildExecutionPrompt(phase: PhaseInfo, verifyCommand?: string): string {
	const rel = (p: string) => path.relative(process.cwd(), p);
	return `You are a fresh child Pi executor for Pi Factory. Use skills pi-gsd and pi-superpowers if available.\n\nExecute exactly one phase.\n\nPhase: ${phase.id} ${phase.name}\nPhase directory: ${rel(phase.dir)}\nPlan: ${rel(phase.planPath)}\nContext: ${rel(phase.contextPath)}\n\nMandatory process:\n1. Read only the project/phase artifacts and the concrete files named in PLAN.md. Do not browse unrelated source files.\n2. Critically review the plan. If fatally unclear, stop and write SUMMARY.md with status: blocked.\n3. For behavior changes, follow TDD: write failing test, run and observe failure, implement minimum, run passing test, refactor.\n4. Execute only this phase. Do not start other phases.\n5. Run verification commands from PLAN.md${verifyCommand ? ` and this required command: ${verifyCommand}` : ""}.\n6. Write ${rel(phase.summaryPath)} with status, changed files, tasks completed, blockers.\n7. Write ${rel(phase.donePath)} as machine-readable JSON exactly like: {"status":"implemented","changedFiles":[],"verificationAttempted":true,"readyForParentVerification":true,"notes":""}.\n8. Write ${rel(phase.verificationPath)} with commands, exit codes, and key output.\n9. Return a concise final report and stop. Do not continue inspecting files after verification passes.\n\nImportant:\n- Do not claim completion without fresh verification evidence.\n- If verification fails, preserve logs and mark status: failed.\n- If blocked, mark status: blocked.\n- Keep changes focused and minimal.\n- Avoid broad audits, package vulnerability remediation, or unrelated cleanup unless explicitly required by the phase.\n- Keep the final answer very brief.\n\nReturn a concise final report with Status, Evidence, Changed files, and Follow-up.`;
}

function buildReviewPrompt(subject: string): string {
	return `Use pi-gstack review discipline. Review this artifact or diff: ${subject || "current project diff"}.\n\nPerspectives required:\n- CEO/Product\n- Engineering Manager\n- Senior Engineer\n- Design/DX\n- QA/Security\n- Orchestrator\n\nIf reviewing code, inspect git diff and relevant files. If reviewing a plan, read the plan.\n\nOutput:\n# Review\n## Executive summary\n## Must fix before execution/ship\n## Should fix / simplify\n## QA checklist\n## Verification gate\n\nDo not make code changes unless explicitly asked.`;
}

function buildDecidePrompt(question: string, context?: string): string {
	return `Use pi-gstack multi-role decision workflow.\n\nQuestion:\n${question}\n\nContext:\n${context || "(none provided)"}\n\nRoles:\n- CEO/Product\n- Engineering Manager\n- Senior Engineer\n- Design/DX\n- QA/Security\n- Orchestrator\n\nOutput exactly this structure:\n# Decision: ${question}\n\n## Final recommendation\n\n## Votes\n| Role | Vote | Rationale |\n|---|---|---|\n\n## Risks\n\n## Dissent / tradeoffs\n\n## Action items\n\n## Revisit trigger\n\nBe practical and concise. Preserve dissent if roles disagree.`;
}

async function commandSendOrDraft(pi: ExtensionAPI, ctx: ExtensionCommandContext, prompt: string, label: string): Promise<void> {
	if (!ctx.isIdle()) {
		pi.sendUserMessage(prompt, { deliverAs: "followUp" });
		ctx.ui.notify(`${label} queued as follow-up.`, "info");
		return;
	}
	pi.sendUserMessage(prompt);
}

function nextActionText(cwd: string): string {
	if (!exists(factoryPath(cwd))) return "/pi-autoplan <goal>";
	const phases = discoverPhases(cwd);
	if (!exists(factoryPath(cwd, "DESIGN.md")) && hasLikelyUiFiles(cwd)) return "/pi-design-system";
	if (!phases.length) return "/pi-create-phase <name>";
	const next = phases.find((p) => p.hasPlan && !["done", "verified"].includes(p.status)) ?? phases.find((p) => !p.hasPlan || !p.hasContext);
	if (!next) return "/pi-review current git diff or /pi-ship-review";
	const check = checkPhaseReadiness(next);
	if (!check.ready) return `/pi-plan-phase ${next.id}`;
	if (hasLikelyUiFiles(cwd, next) && !exists(path.join(next.dir, "UI-SPEC.md"))) return `/pi-ui-phase ${next.id}`;
	return `/build-loop ${next.id} --dry-run`;
}

function statusText(cwd: string): string {
	const phases = discoverPhases(cwd);
	const rootExists = exists(factoryPath(cwd));
	if (!rootExists) return "No .pi-factory directory found. Run /pi-new-project <idea>.";
	const completed = phases.filter((p) => ["verified", "done"].includes(p.status)).length;
	const progress = phases.length ? `${completed}/${phases.length}` : "0/0";
	const rows = phases.map((p) => `| ${String(p.id).padStart(2, "0")} | ${p.name} | ${p.status} | ${p.hasPlan ? "yes" : "no"} | ${p.hasContext ? "yes" : "no"} | ${exists(path.join(p.dir, "UI-SPEC.md")) ? "yes" : hasLikelyUiFiles(cwd, p) ? "missing" : "n/a"} |`).join("\n");
	return `# Pi Factory Status\n\nRoot: ${factoryPath(cwd)}\nProgress: ${progress}\nDesign system: ${exists(factoryPath(cwd, "DESIGN.md")) ? "yes" : "missing"}\n\n| Phase | Name | Status | Plan | Context | UI-SPEC |\n|---:|---|---|---|---|---|\n${rows || "| - | No phases | - | - | - | - |"}\n\nNext executable: ${phases.find((p) => p.hasPlan && !["done", "verified"].includes(p.status))?.name ?? "none"}\nNext action: \`${nextActionText(cwd)}\``;
}

function writeMarkdownResult(cwd: string, prefix: string, content: string): string {
	ensureFactory(cwd);
	const file = factoryPath(cwd, DECISIONS_DIR, `${timestampForFile()}-${slugify(prefix)}.md`);
	fs.writeFileSync(file, content, "utf-8");
	return file;
}

function getPlanSection(plan: string, heading: string): string {
	const lines = plan.split(/\r?\n/);
	const start = lines.findIndex((line) => new RegExp(`^#{2,4}\\s+${escapeRegExp(heading)}\\s*$`, "i").test(line.trim()));
	if (start < 0) return "";
	const out: string[] = [];
	for (let i = start + 1; i < lines.length; i++) {
		if (/^#{1,4}\s+/.test(lines[i])) break;
		out.push(lines[i]);
	}
	return out.join("\n").trim();
}

function checkPhaseReadiness(phase: PhaseInfo): CheckResult {
	const mustFix: string[] = [];
	const shouldFix: string[] = [];
	const cwd = path.dirname(path.dirname(phase.dir));
	if (!phase.hasContext) mustFix.push("CONTEXT.md is missing.");
	if (!phase.hasPlan) {
		mustFix.push("PLAN.md is missing.");
		return { phase, ready: false, mustFix, shouldFix, verificationSteps: [] };
	}
	const plan = readText(phase.planPath);
	const requiredSections = ["Objective", "Files to read first", "Tasks", "Verification commands", "Done criteria", "Failure handling"];
	for (const section of requiredSections) {
		if (!new RegExp(`^#{2,4}\\s+${escapeRegExp(section)}`, "im").test(plan)) mustFix.push(`${section} section is missing.`);
	}
	const objective = getPlanSection(plan, "Objective");
	if (/\bTBD\b/i.test(objective) || !objective.trim()) mustFix.push("Objective is missing or still contains TBD.");
	const verificationSteps = extractVerificationSteps(plan);
	if (verificationSteps.length === 0) mustFix.push("PLAN.md has no valid verification command.");
	if (/\bTBD\b/i.test(getPlanSection(plan, "Verification commands"))) mustFix.push("Verification commands still contain TBD.");
	const tasks = getPlanSection(plan, "Tasks");
	if (/\bTBD\b/i.test(tasks)) mustFix.push("Tasks still contain TBD.");
	else if (/implement everything|finish (the )?(app|feature|ui)|do all/i.test(tasks)) shouldFix.push("Tasks look too broad.");
	const done = getPlanSection(plan, "Done criteria");
	if (/\bTBD\b/i.test(done)) mustFix.push("Done criteria still contain TBD.");
	else if (done.trim().split(/\r?\n/).filter(Boolean).length < 2) shouldFix.push("Done criteria are weak or incomplete.");
	const files = getPlanSection(plan, "Files to read first");
	if (!/`[^`]+`/.test(files) && !/\n\s*[-*]\s+\S+/.test(files)) shouldFix.push("Files to read first should list concrete paths.");
	if (hasLikelyUiFiles(cwd, phase)) {
		if (!exists(factoryPath(cwd, "DESIGN.md"))) shouldFix.push("User-facing/UI project appears to lack .pi-factory/DESIGN.md. Run /pi-design-system.");
		if (!exists(path.join(phase.dir, "UI-SPEC.md"))) shouldFix.push("UI phase appears to lack UI-SPEC.md. Run /pi-ui-phase before implementation.");
	}
	return { phase, ready: mustFix.length === 0, mustFix, shouldFix, verificationSteps };
}

function checkText(result: CheckResult): string {
	const phase = result.phase;
	return `# Pi Factory Check\n\n${phase ? `Phase ${String(phase.id).padStart(2, "0")} ${phase.name}: ${result.ready ? "READY" : "NOT READY"}` : "Project: NOT READY"}\n\n## Must fix\n${result.mustFix.length ? result.mustFix.map((m) => `- ${m}`).join("\n") : "- None"}\n\n## Should fix\n${result.shouldFix.length ? result.shouldFix.map((m) => `- ${m}`).join("\n") : "- None"}\n\n## Verification steps\n${result.verificationSteps.length ? result.verificationSteps.map((s) => `- \`${s.command}\`${s.optional ? " (optional)" : " (required)"}${s.timeoutMs ? ` timeout=${s.timeoutMs}` : ""}`).join("\n") : "- None"}\n\nRecommended next command:\n${result.ready ? "/build-loop --max-phases 1" : `/pi-plan-phase ${phase ? phase.id : "<phase>"}`}`;
}

function readDoneProtocol(phase: PhaseInfo): DoneProtocol | undefined {
	return readDoneProtocolPath(phase.donePath);
}

function docsText(_cwd: string): string {
	return `# Pi Factory Docs\n\nExtension: \`~/.pi/agent/extensions/pi-factory/index.ts\`\nDocs: \`~/.pi/agent/extensions/pi-factory/README.md\`\nUse cases: \`~/.pi/agent/extensions/pi-factory/USECASES.md\`\nNext enhancements: \`~/.pi/agent/extensions/pi-factory/NEXT_ENHANCEMENTS.md\`\n\n## Core commands\n- \`/pi-dashboard\` — Pi-native interactive factory cockpit\n- \`/pi-next\` — show next best action\n- \`/pi-status\` — phase status\n- \`/pi-factory-check [phase]\` — deterministic readiness check\n- \`/build-loop --dry-run\` — preview next phase + effective options\n- \`/build-loop --max-phases 1 --require-check\` — execute with readiness gate\n- \`/pi-plan-phase [phase]\` — create/refine PLAN.md\n\n## Design / UI / DX commands\n- \`/pi-design-system\` — create/update \`.pi-factory/DESIGN.md\`\n- \`/pi-ui-phase [phase]\` — create/update phase \`UI-SPEC.md\` design contract\n- \`/pi-sketch <idea>\` — create 2-3 throwaway HTML design variants\n- \`/pi-design-review [phase] [--url URL] [--fix] [--waive]\` — screenshot/code 6-pillar UI audit\n- \`/pi-dx-review\` — developer-experience audit prompt\n- \`/pi-ship-review\` — final product/eng/design/QA release gate\n`;
}

function nextText(): string {
	return `# Pi Factory MVP 2.1 Hardening\n\nImplemented focus areas:\n- Config loader: CLI flags > .pi-factory/config.json > defaults.\n- Structured verification extraction: YAML block, fenced shell block, Markdown table, inline backticks.\n- Readiness checker: /pi-factory-check and /pi-check.\n- Build-loop --require-check gate.\n- Child max-turn and idle-timeout guards.\n- DONE.json done protocol prompt + parent summary capture.\n- Parent safety audit for protected paths, changed file count, and diff size.\n- Dangerous verification command detector with --allow-dangerous-verify override.\n\nRecommended next hardening:\n- True sandbox/worktree child execution.\n- Project adapters (sveltekit-prisma, node, python, rust).\n- Strong phase.json contract validation.\n- Resume/crash recovery command.\n`;
}

async function runVerification(pi: ExtensionAPI, cwd: string, phase: PhaseInfo, verifyCommand?: string, timeoutMs = DEFAULT_VERIFY_TIMEOUT_MS): Promise<VerificationResult[]> {
	let steps: VerificationStep[] = [];
	if (verifyCommand) steps = [{ command: verifyCommand, optional: false, source: "--verify" }];
	else if (exists(phase.planPath)) steps = extractVerificationSteps(readText(phase.planPath));
	if (steps.length === 0) return [];

	const results: VerificationResult[] = [];
	for (const step of steps) {
		const skipped = await maybeSkipOptionalVerification(pi, cwd, step);
		if (skipped) {
			results.push(skipped);
			continue;
		}
		const effectiveTimeout = step.timeoutMs ?? timeoutMs;
		const result = await runCommand(pi, cwd, step.command, effectiveTimeout).catch((err) => ({ code: 1, stdout: "", stderr: String(err), killed: false }));
		results.push({ command: step.command, code: result.code, stdout: result.stdout, stderr: result.stderr, optional: step.optional, timeoutMs: effectiveTimeout });
		if (result.code !== 0) break;
	}
	return results;
}

function writeVerificationFile(phase: PhaseInfo, results: VerificationResult[]): void {
	const ok = results.length > 0 && results.every((r) => r.code === 0);
	const body = [`# Verification`, ``, `Status: ${ok ? "verified" : results.length === 0 ? "no-command" : "failed"}`, `Timestamp: ${nowIso()}`, ``];
	if (results.length === 0) {
		body.push("No verification command was configured or found in PLAN.md.", "");
	} else {
		for (const r of results) {
			body.push(`## \`${r.command}\``, ``, `Exit: ${r.code}${r.skipped ? " (skipped)" : ""}`);
			if (r.reason) body.push(``, `Reason: ${r.reason}`);
			body.push(``, `<details><summary>stdout</summary>`, "", "```", r.stdout.slice(-12000), "```", "", `</details>`, "");
			if (r.stderr.trim()) body.push(`<details><summary>stderr</summary>`, "", "```", r.stderr.slice(-12000), "```", "", `</details>`, "");
		}
	}
	fs.writeFileSync(phase.verificationPath, body.join("\n"), "utf-8");
}

function globToRegExp(pattern: string): RegExp {
	const escaped = escapeRegExp(pattern).replace(/\\\*\\\*/g, ".*").replace(/\\\*/g, "[^/]*");
	return new RegExp(`^${escaped}$`);
}

function matchesAnyPattern(file: string, patterns: string[]): boolean {
	const normalized = String(file).replace(/\\/g, "/");
	return patterns.some((pattern) => globToRegExp(String(pattern).replace(/\\/g, "/")).test(normalized));
}

async function safetyAudit(pi: ExtensionAPI, cwd: string, phase: PhaseInfo, options: EffectiveBuildOptions): Promise<{ ok: boolean; notes: string[]; changedFiles: string[]; diffLines: number }> {
	const notes: string[] = [];
	const changedFiles = (await getGitChangedFiles(pi, cwd)).filter((file) => {
		const normalized = String(file).replace(/\\/g, "/");
		const phaseRel = path.relative(cwd, phase.dir).replace(/\\/g, "/");
		return !normalized.startsWith(`${FACTORY_DIR}/runs/`) && !normalized.startsWith(`${phaseRel}/`);
	});
	const diffLines = await getGitDiffLineCount(pi, cwd);
	const protectedChanged = changedFiles.filter((file) => matchesAnyPattern(file, options.protectedPaths));
	if (protectedChanged.length && !options.allowProtectedChanges) notes.push(`Protected paths changed: ${protectedChanged.join(", ")}`);
	if (options.maxChangedFiles !== undefined && changedFiles.length > options.maxChangedFiles && !options.allowLargeDiff) notes.push(`Changed files ${changedFiles.length} exceeds maxChangedFiles ${options.maxChangedFiles}.`);
	if (options.maxDiffLines !== undefined && diffLines > options.maxDiffLines && !options.allowLargeDiff) notes.push(`Diff lines ${diffLines} exceeds maxDiffLines ${options.maxDiffLines}.`);
	return { ok: notes.length === 0, notes, changedFiles, diffLines };
}

function findPackageScript(cwd: string, scriptNames: string[]): string | undefined {
	const packageJsonPath = path.join(cwd, "package.json");
	if (!exists(packageJsonPath)) return undefined;
	try {
		const pkg = readJsonFile<{ scripts?: Record<string, string> }>(packageJsonPath);
		const scripts = pkg.scripts ?? {};
		for (const name of scriptNames) {
			if (scripts[name]) return name;
		}
	} catch {
		return undefined;
	}
	return undefined;
}

function detectDevServerCommand(cwd: string): string | undefined {
	const script = findPackageScript(cwd, ["dev", "start", "preview"]);
	return script ? `npm run ${script}` : undefined;
}

function detectCheckCommand(cwd: string): string | undefined {
	const script = findPackageScript(cwd, ["check", "lint", "test", "build"]);
	return script ? `npm run ${script}` : undefined;
}

function hasLikelyUiFiles(cwd: string, phase?: PhaseInfo): boolean {
	const targets = [phase?.planPath, phase?.contextPath].filter(Boolean) as string[];
	for (const target of targets) {
		if (!exists(target)) continue;
		const text = readText(target);
		if (/\b(UI|UX|frontend|component|page|screen|route|layout|svelte|react|vue|css|tailwind|design)\b/i.test(text)) return true;
	}
	const probes = ["src/routes", "src/components", "src/lib/components", "app", "pages", "components"];
	return probes.some((p) => exists(path.join(cwd, p)));
}

function genericCopyFindings(cwd: string): string[] {
	const findings: string[] = [];
	const roots = ["src", "app", "pages", "components"].filter((root) => exists(path.join(cwd, root)));
	if (!roots.length) return findings;
	const patterns = [/\bSubmit\b/g, /\bClick here\b/gi, /\bOK\b/g, /Something went wrong/gi, /No data/gi, /No results/gi];
	const files: string[] = [];
	const walk = (dir: string) => {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				if (!["node_modules", ".git", "dist", "build", ".svelte-kit"].includes(entry.name)) walk(full);
			} else if (/\.(svelte|tsx|jsx|vue|html|css|ts|js)$/.test(entry.name)) files.push(full);
		}
	};
	for (const root of roots) walk(path.join(cwd, root));
	for (const file of files.slice(0, 300)) {
		const text = readText(file);
		for (const pattern of patterns) {
			pattern.lastIndex = 0;
			if (pattern.test(text)) findings.push(`${path.relative(cwd, file)} contains generic copy pattern ${pattern.source}`);
		}
	}
	return findings.slice(0, 20);
}

function countRegexMatches(text: string, regex: RegExp): number {
	const matches = text.match(regex);
	return matches ? matches.length : 0;
}

function uiCodeHeuristics(cwd: string): { findings: string[]; scores: Record<string, number> } {
	const findings: string[] = [];
	const roots = ["src", "app", "pages", "components"].filter((root) => exists(path.join(cwd, root)));
	let text = "";
	const files: string[] = [];
	const walk = (dir: string) => {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				if (!["node_modules", ".git", "dist", "build", ".svelte-kit"].includes(entry.name)) walk(full);
			} else if (/\.(svelte|tsx|jsx|vue|html|css)$/.test(entry.name)) files.push(full);
		}
	};
	for (const root of roots) walk(path.join(cwd, root));
	for (const file of files.slice(0, 200)) text += `\n/* ${path.relative(cwd, file)} */\n${readText(file).slice(0, 30000)}`;
	const arbitrarySpacing = countRegexMatches(text, /\b[mp][trblxy]?\s*-\s*\[[^\]]+\]/g);
	const hardcodedColors = countRegexMatches(text, /#[0-9a-fA-F]{3,8}\b|rgb\(|rgba\(/g);
	const genericCopy = genericCopyFindings(cwd);
	if (arbitrarySpacing > 8) findings.push(`High arbitrary spacing usage (${arbitrarySpacing}); prefer DESIGN.md spacing scale.`);
	if (hardcodedColors > 8) findings.push(`High hardcoded color usage (${hardcodedColors}); prefer design tokens/classes.`);
	findings.push(...genericCopy);
	return {
		findings,
		scores: {
			copywriting: genericCopy.length ? 2 : 3,
			visuals: files.length ? 3 : 2,
			color: hardcodedColors > 8 ? 2 : 3,
			typography: /text-\[[^\]]+\]|font-\[[^\]]+\]/.test(text) ? 2 : 3,
			spacing: arbitrarySpacing > 8 ? 2 : 3,
			interaction: /aria-|role=|on:click|onclick|onClick|href=/.test(text) ? 3 : 2,
		},
	};
}

function writeSummaryFile(phase: PhaseInfo, status: string, child: RunPiResult, verification: VerificationResult[], gitStatus: string, done?: DoneProtocol, safetyNotes: string[] = []): void {
	const verificationSummary = verification.length
		? verification.map((r) => `- \`${r.command}\`: ${r.skipped ? `skipped (${r.reason ?? "optional"})` : `exit ${r.code}`}`).join("\n")
		: "- No verification command run.";
	const doneSummary = done ? `\n## Done protocol\n\n\`\`\`json\n${JSON.stringify(done, null, 2)}\n\`\`\`\n` : "";
	const safetySummary = safetyNotes.length ? `\n## Safety notes\n\n${safetyNotes.map((n) => `- ${n}`).join("\n")}\n` : "";
	const body = `# Summary\n\nStatus: ${status}\nTimestamp: ${nowIso()}\n\n## Child Pi result\n\n- Exit: ${child.exitCode}\n- Stop reason: ${child.stopReason ?? "unknown"}\n- Turns: ${child.usage.turns}\n\n## Final output\n\n${child.finalOutput || "(no final output)"}\n${doneSummary}${safetySummary}\n## Verification\n\n${verificationSummary}\n\n## Git status after phase\n\n\`\`\`\n${gitStatus || "clean"}\n\`\`\`\n`;
	fs.writeFileSync(phase.summaryPath, body, "utf-8");
}

class PiFactoryDashboard implements Component {
	private phases: PhaseInfo[];
	private selected = 0;
	constructor(private cwd: string, private theme: Theme, private done: (value: string | undefined) => void) {
		this.phases = discoverPhases(cwd);
	}

	handleInput(data: string): void {
		if (matchesKey(data, Key.up) && this.selected > 0) this.selected--;
		else if (matchesKey(data, Key.down) && this.selected < Math.max(0, this.phases.length - 1)) this.selected++;
		else if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c")) || data === "q") this.done(undefined);
		else if (matchesKey(data, Key.enter)) this.done(this.commandForSelected("run"));
		else if (data === "p") this.done(this.commandForSelected("plan"));
		else if (data === "r") this.done("/pi-review current git diff");
		else if (data === "d") this.done(this.commandForSelected("design"));
		else if (data === "s") this.done("/pi-status");
		else if (data === "n") this.done(nextActionText(this.cwd));
	}

	private commandForSelected(action: "run" | "plan" | "design"): string | undefined {
		const phase = this.phases[this.selected];
		if (!phase) return nextActionText(this.cwd);
		if (action === "plan") return `/pi-plan-phase ${phase.id}`;
		if (action === "design") return `/pi-design-review ${phase.id}`;
		return `/build-loop ${phase.id} --dry-run`;
	}

	render(width: number): string[] {
		this.phases = discoverPhases(this.cwd);
		const completed = this.phases.filter((p) => ["verified", "done"].includes(p.status)).length;
		const total = this.phases.length || 1;
		const barWidth = Math.min(24, Math.max(8, width - 30));
		const filled = Math.round((completed / total) * barWidth);
		const bar = `${"█".repeat(filled)}${"░".repeat(barWidth - filled)}`;
		const lines = [
			this.theme.bold("🏭 Pi Factory Dashboard"),
			`Progress: ${bar} ${completed}/${this.phases.length}`,
			`Design: ${exists(factoryPath(this.cwd, "DESIGN.md")) ? "✓ .pi-factory/DESIGN.md" : "! missing DESIGN.md"}`,
			"",
			"Phases",
		];
		if (!this.phases.length) lines.push("  No phases. Press n for next action.");
		for (let i = 0; i < this.phases.length; i++) {
			const p = this.phases[i]!;
			const icon = p.status === "verified" || p.status === "done" ? "✓" : p.status === "blocked" || p.status === "failed" ? "!" : p.status === "running" ? "▶" : "·";
			const sel = i === this.selected ? ">" : " ";
			const ui = exists(path.join(p.dir, "UI-SPEC.md")) ? " UI✓" : hasLikelyUiFiles(this.cwd, p) ? " UI!" : "";
			lines.push(`${sel} ${icon} ${String(p.id).padStart(2, "0")} ${p.name} [${p.status}]${ui}`);
		}
		lines.push("", "Keys: ↑/↓ select  Enter dry-run  p plan  d design-review  r review  n next  s status  q close", `Next: ${nextActionText(this.cwd)}`);
		return lines.map((line) => truncateToWidth(line, width));
	}

	invalidate(): void {}
}

interface DesignReviewOptions {
	phase?: PhaseInfo;
	url?: string;
	fix?: boolean;
	waive?: boolean;
}

function scoreBar(score: number): string {
	return `${"●".repeat(Math.max(0, score))}${"○".repeat(Math.max(0, 4 - score))} ${score}/4`;
}

async function captureScreenshot(pi: ExtensionAPI, cwd: string, url: string, out: string, viewport: string): Promise<VerificationResult> {
	ensureDir(path.dirname(out));
	const command = `npx --yes playwright screenshot --viewport-size=${viewport} ${JSON.stringify(url)} ${JSON.stringify(out)}`;
	const result = await runCommand(pi, cwd, command, 120_000).catch((err) => ({ code: 1, stdout: "", stderr: String(err) }));
	return { command, code: result.code, stdout: result.stdout, stderr: result.stderr, timeoutMs: 120_000 };
}

async function runDesignReview(pi: ExtensionAPI, ctx: ExtensionCommandContext, options: DesignReviewOptions): Promise<void> {
	ensureFactory(ctx.cwd);
	const phase = options.phase;
	const reportDir = phase ? path.join(phase.dir, "ui-review") : factoryPath(ctx.cwd, "ui-reviews", timestampForFile());
	const screenshotDir = path.join(reportDir, UI_REVIEW_SCREENSHOT_DIR);
	ensureDir(screenshotDir);
	writeIfMissing(path.join(screenshotDir, ".gitignore"), "# Screenshot files — never commit binary artifacts\n*.png\n*.webp\n*.jpg\n*.jpeg\n*.gif\n*.bmp\n*.tiff\n");

	let url = options.url;
	const screenshotResults: VerificationResult[] = [];
	if (!url) {
		for (const candidate of ["http://localhost:3000", "http://localhost:5173", "http://localhost:8080", "http://localhost:4173"]) {
			const probe = await runCommand(pi, ctx.cwd, `curl -s -o /dev/null -w "%{http_code}" ${candidate}`, 15_000).catch(() => ({ code: 1, stdout: "000", stderr: "" }));
			if (/^2|3/.test(probe.stdout.trim())) {
				url = candidate;
				break;
			}
		}
	}
	if (url) {
		screenshotResults.push(await captureScreenshot(pi, ctx.cwd, url, path.join(screenshotDir, "desktop.png"), "1440,900"));
		screenshotResults.push(await captureScreenshot(pi, ctx.cwd, url, path.join(screenshotDir, "tablet.png"), "768,1024"));
		screenshotResults.push(await captureScreenshot(pi, ctx.cwd, url, path.join(screenshotDir, "mobile.png"), "375,812"));
	}

	const heuristics = uiCodeHeuristics(ctx.cwd);
	const scores = heuristics.scores;
	const minScore = Math.min(...Object.values(scores));
	const status = options.waive || minScore >= 3 ? "pass" : "blocked";
	const designPath = path.join(ctx.cwd, "DESIGN.md");
	const piDesignPath = factoryPath(ctx.cwd, "DESIGN.md");
	const uiSpecPath = phase ? path.join(phase.dir, "UI-SPEC.md") : undefined;
	const body = [`# UI Review${phase ? `: Phase ${String(phase.id).padStart(2, "0")} ${phase.name}` : ""}`, ``, `Status: ${status}`, `Timestamp: ${nowIso()}`, `URL: ${url ?? "not detected; code-only audit"}`, `Baseline: ${exists(piDesignPath) ? path.relative(ctx.cwd, piDesignPath) : exists(designPath) ? "DESIGN.md" : "abstract UI standards"}${uiSpecPath && exists(uiSpecPath) ? ` + ${path.relative(ctx.cwd, uiSpecPath)}` : ""}`, ``, `## Scorecard`, ``, `| Pillar | Score | Gate |`, `|---|---:|---|`];
	for (const [pillar, score] of Object.entries(scores)) body.push(`| ${pillar} | ${scoreBar(score)} | ${score >= 3 || options.waive ? "PASS" : "BLOCK"} |`);
	body.push(``, `## Screenshot evidence`, ``);
	if (screenshotResults.length) {
		for (const r of screenshotResults) body.push(`- \`${r.command}\`: exit ${r.code}`);
		body.push(`- Directory: \`${path.relative(ctx.cwd, screenshotDir)}\``);
	} else body.push("- No live URL detected. Run with `/pi-design-review <phase> --url http://localhost:PORT` for visual evidence.");
	body.push(``, `## Findings`, ``);
	body.push(...(heuristics.findings.length ? heuristics.findings.map((f) => `- ${f}`) : ["- No blocking code heuristics found. Visual judgment still requires screenshot review."]));
	body.push(``, `## Recommended fixes`, ``);
	if (minScore < 3 && !options.waive) {
		body.push("- Improve blocked pillars before shipping.", "- Re-run `/pi-design-review` after fixes.", "- If accepting tradeoff, record waiver with `/pi-decide` and rerun with `--waive`.");
	} else {
		body.push("- Keep screenshots and report as release evidence.");
	}
	body.push(``, `## Design review rules`, ``, "- 4 = excellent / contract met", "- 3 = good enough to ship", "- 2 = needs work", "- 1 = poor/blocking", "- Ship gate: every pillar >= 3/4 unless waiver is recorded.", "");
	const reportPath = path.join(reportDir, "UI-REVIEW.md");
	fs.writeFileSync(reportPath, body.join("\n"), "utf-8");
	if (phase) updateState(ctx.cwd, phase, status === "pass" ? "verified" : "blocked", `design review ${status}`);
	pi.sendMessage({ customType: "pi-factory", content: `${body.slice(0, 35).join("\n")}\n\nReport: \`${path.relative(ctx.cwd, reportPath)}\``, display: true, details: { reportPath, scores, status, screenshotResults } }, { triggerTurn: false });

	if (options.fix && status === "blocked") {
		const prompt = `Use pi-gstack Design/DX and pi-superpowers discipline. Fix the UI design review findings in ${path.relative(ctx.cwd, reportPath)}. Read DESIGN.md/.pi-factory/DESIGN.md and UI-SPEC.md if present. Make focused visual/copy/accessibility fixes only. Capture before/after evidence where possible. Run project checks. Do not expand product scope.`;
		await commandSendOrDraft(pi, ctx, prompt, "Design fix");
	}
}

async function runBuildLoop(pi: ExtensionAPI, ctx: ExtensionCommandContext, rawArgs: string): Promise<void> {
	const parsed = parseArgs(rawArgs);
	ensureFactory(ctx.cwd);
	const { config, error: configError } = loadConfig(ctx.cwd);
	if (configError) {
		ctx.ui.notify(configError, "error");
		pi.sendMessage({ customType: "pi-factory", content: configError, display: true }, { triggerTurn: false });
		return;
	}
	const options = buildEffectiveOptions(parsed, config);
	const from = flagString(parsed, "from");
	const only = flagString(parsed, "phase") ?? parsed.positionals[0];
	const verifyCommand = options.verifyCommand;

	let phases = discoverPhases(ctx.cwd).filter((p) => p.hasPlan && !["done", "verified"].includes(p.status));
	if (only) {
		const phase = findPhase(ctx.cwd, only);
		phases = phase && !["done", "verified"].includes(phase.status) ? [phase] : [];
	} else if (from) {
		const n = Number(from);
		if (Number.isFinite(n)) phases = phases.filter((p) => p.id >= n);
	}
	phases = phases.slice(0, Math.max(1, options.maxPhases));

	const runRecord: LoopRunRecord = {
		startedAt: nowIso(),
		cwd: ctx.cwd,
		args: rawArgs,
		maxPhases: options.maxPhases,
		verifyCommand,
		dryRun: options.dryRun,
		effectiveOptions: options,
		phases: [],
	};
	const runLogPath = factoryPath(ctx.cwd, RUNS_DIR, `build-loop-${timestampForFile()}.json`);

	if (phases.length === 0) {
		const message = only ? `No executable phase found for ${only}. It may already be verified/done.` : "No executable phases found. Create PLAN.md files under .pi-factory/phases/.";
		ctx.ui.notify(message, "warning");
		pi.sendMessage({ customType: "pi-factory", content: message, display: true }, { triggerTurn: false });
		fs.writeFileSync(runLogPath, `${JSON.stringify({ ...runRecord, endedAt: nowIso() }, null, 2)}\n`, "utf-8");
		return;
	}

	if (options.dryRun) {
		const list = phases.map((p) => {
			const check = checkPhaseReadiness(p);
			return `${String(p.id).padStart(2, "0")} ${p.name} (${p.status}) — ${check.ready ? "ready" : "not ready"}`;
		}).join("\n");
		pi.sendMessage({ customType: "pi-factory", content: `# Build Loop Dry Run\n\nWould execute:\n\n${list}\n\nEffective options:\n\n\`\`\`json\n${JSON.stringify(options, null, 2)}\n\`\`\``, display: true }, { triggerTurn: false });
		fs.writeFileSync(runLogPath, `${JSON.stringify({ ...runRecord, endedAt: nowIso() }, null, 2)}\n`, "utf-8");
		return;
	}

	ctx.ui.notify(`Build loop starting: ${phases.length} phase(s).`, "info");
	ctx.ui.setStatus("pi-factory", `🏭 0/${phases.length}`);

	for (let i = 0; i < phases.length; i++) {
		const phase = phases[i];
		const readiness = checkPhaseReadiness(phase);
		const record = { id: phase.id, name: phase.name, slug: phase.slug, status: "running", attempts: 0, summaryPath: phase.summaryPath, verificationPath: phase.verificationPath };
		runRecord.phases.push(record);
		if (options.requireCheck && !readiness.ready) {
			record.status = "blocked";
			record.error = readiness.mustFix.join("; ");
			updateState(ctx.cwd, phase, "blocked", `readiness check failed: ${record.error}`);
			fs.writeFileSync(phase.summaryPath, `${checkText(readiness)}\n`, "utf-8");
			if (!options.continueOnFailure) break;
			continue;
		}
		const verificationSteps = verifyCommand ? [{ command: verifyCommand, optional: false, source: "--verify" }] : readiness.verificationSteps;
		const dangerous = verificationSteps.filter((step) => hasDangerousCommand(step.command));
		if (dangerous.length && !options.allowDangerousVerify) {
			record.status = "blocked";
			record.error = `dangerous verification command blocked: ${dangerous.map((d) => d.command).join(", ")}`;
			updateState(ctx.cwd, phase, "blocked", record.error);
			fs.writeFileSync(phase.summaryPath, `# Summary\n\nStatus: blocked\nTimestamp: ${nowIso()}\n\n${record.error}\n`, "utf-8");
			if (!options.continueOnFailure) break;
			continue;
		}
		updateState(ctx.cwd, phase, "running", "build-loop started");
		ctx.ui.setStatus("pi-factory", `🏭 ${i}/${phases.length} phase ${String(phase.id).padStart(2, "0")}`);

		let child: RunPiResult | undefined;
		let verification: VerificationResult[] = [];
		let status: PhaseStatus = "failed";
		let lastError = "";
		for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
			record.attempts = attempt + 1;
			const attemptPrompt = `${buildExecutionPrompt(phase, verifyCommand)}\n\nAttempt: ${attempt + 1}/${options.maxRetries + 1}`;
			child = await runPiJson(attemptPrompt, ctx.cwd, {
				timeoutMs: options.childTimeoutMs,
				idleTimeoutMs: options.childIdleTimeoutMs,
				tools: options.childTools,
				maxTurns: options.maxAgentTurns,
				onText: undefined,
			});
			record.childExitCode = child.exitCode;
			verification = await runVerification(pi, ctx.cwd, phase, verifyCommand, options.verifyTimeoutMs);
			const verificationOk = verification.length === 0 ? child.exitCode === 0 : verification.every((r) => r.code === 0);
			record.verificationExitCode = verification.length ? verification[verification.length - 1].code : undefined;
			// Parent-side verification is the authority. Some child Pi runs keep trying to
			// produce extra summaries and can time out after making valid changes; if the
			// explicit verification gate passes, accept the phase as verified.
			if (verificationOk) {
				status = "verified";
				break;
			}
			lastError = `child exit ${child.exitCode}; verification ${verification.length ? verification.map((r) => `${r.command}=${r.code}`).join(", ") : "not run"}`;
			if (attempt < options.maxRetries) {
				appendFile(phase.summaryPath, `\n\n## Retry ${attempt + 1}\n\n${lastError}\n`);
			}
		}

		if (!child) throw new Error("Internal error: child result missing");
		writeVerificationFile(phase, verification);
		const childLogPath = path.join(phase.dir, `CHILD-${timestampForFile()}.json`);
		fs.writeFileSync(
			childLogPath,
			`${JSON.stringify(
				{
					exitCode: child.exitCode,
					stderr: child.stderr,
					stdoutTail: child.stdout.slice(-40000),
					finalOutput: child.finalOutput,
					usage: child.usage,
					stopReason: child.stopReason,
					errorMessage: child.errorMessage,
				},
				null,
				2,
			)}\n`,
			"utf-8",
		);
		const done = readDoneProtocol(phase);
		const veto = doneProtocolVeto(done);
		if (veto && status === "verified") {
			status = veto.status;
			lastError = veto.reason;
		}
		const safety = await safetyAudit(pi, ctx.cwd, phase, options);
		if (status === "verified" && !safety.ok) {
			status = "blocked";
			lastError = safety.notes.join("; ");
		}
		const gitStatus = await getGitStatus(pi, ctx.cwd);
		writeSummaryFile(phase, status, child, verification, gitStatus, done, safety.notes);
		record.status = status;
		if (lastError) record.error = lastError;

		if (status === "verified") {
			updateState(ctx.cwd, phase, "verified", "build-loop verification passed");
			if (!options.noCheckpoint) {
				const checkpoint = await gitCheckpoint(pi, ctx.cwd, `pi-factory: phase ${String(phase.id).padStart(2, "0")} ${phase.slug}`);
				appendFile(phase.summaryPath, `\n\n## Checkpoint\n\n${checkpoint.output}\n`);
			}
		} else if (status === "blocked") {
			updateState(ctx.cwd, phase, "blocked", lastError || "build-loop blocked by safety/readiness gate");
			if (!options.continueOnFailure) break;
		} else {
			updateState(ctx.cwd, phase, "failed", lastError || "build-loop failed");
			if (!options.continueOnFailure) break;
		}

		fs.writeFileSync(runLogPath, `${JSON.stringify(runRecord, null, 2)}\n`, "utf-8");
	}

	runRecord.endedAt = nowIso();
	fs.writeFileSync(runLogPath, `${JSON.stringify(runRecord, null, 2)}\n`, "utf-8");
	ctx.ui.setStatus("pi-factory", undefined);
	const completed = runRecord.phases.filter((p) => p.status === "verified").length;
	pi.sendMessage(
		{
			customType: "pi-factory",
			content: `# Build Loop Finished\n\nVerified phases: ${completed}/${runRecord.phases.length}\n\nRun log: \`${path.relative(ctx.cwd, runLogPath)}\`\n\n${runRecord.phases.map((p) => `- Phase ${String(p.id).padStart(2, "0")} ${p.name}: ${p.status} (${p.attempts} attempt(s))`).join("\n")}`,
			display: true,
			details: runRecord,
		},
		{ triggerTurn: false },
	);
}

const BuildLoopParams = Type.Object({
	phase: Type.Optional(Type.String({ description: "Phase number or slug. If omitted, runs next executable phase." })),
	maxPhases: Type.Optional(Type.Number({ description: "Maximum number of phases to execute.", default: DEFAULT_MAX_PHASES })),
	verify: Type.Optional(Type.String({ description: "Override verification command." })),
	dryRun: Type.Optional(Type.Boolean({ description: "Show what would run without executing." })),
	retries: Type.Optional(Type.Number({ description: "Retry count per phase.", default: MAX_RETRIES_DEFAULT })),
	requireCheck: Type.Optional(Type.Boolean({ description: "Require readiness check before child execution." })),
});

export default function piFactory(pi: ExtensionAPI): void {
	pi.registerCommand("pi-new-project", {
		description: "Initialize .pi-factory project planning files",
		handler: async (args, ctx) => {
			const created = ensureFactory(ctx.cwd, args.trim());
			ctx.ui.notify(created.length ? `Created: ${created.join(", ")}` : ".pi-factory already exists", "info");
			const prompt = `Use pi-gsd, pi-superpowers, and pi-gstack. Initialize/refine the Pi Factory project from this idea:\n\n${args.trim() || "(no idea provided)"}\n\nRead/update .pi-factory/PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md. Ask concise questions if needed. Do not implement code yet.`;
			await commandSendOrDraft(pi, ctx, prompt, "Project initialization");
		},
	});

	const showStatus = async (_args: string, ctx: ExtensionCommandContext) => {
		pi.sendMessage({ customType: "pi-factory", content: statusText(ctx.cwd), display: true }, { triggerTurn: false });
	};

	pi.registerCommand("pi-factory-status", {
		description: "Show .pi-factory status",
		handler: showStatus,
	});

	pi.registerCommand("pi-status", {
		description: "Alias for /pi-factory-status",
		handler: showStatus,
	});

	const checkHandler = async (args: string, ctx: ExtensionCommandContext) => {
		ensureFactory(ctx.cwd);
		const phase = findPhase(ctx.cwd, args.trim() || undefined);
		if (!phase) {
			ctx.ui.notify("Phase not found or no executable phase exists.", "warning");
			return;
		}
		pi.sendMessage({ customType: "pi-factory", content: checkText(checkPhaseReadiness(phase)), display: true }, { triggerTurn: false });
	};

	pi.registerCommand("pi-factory-check", {
		description: "Check whether a phase is ready for deterministic build-loop execution",
		handler: checkHandler,
	});

	pi.registerCommand("pi-check", {
		description: "Alias for /pi-factory-check",
		handler: checkHandler,
	});

	pi.registerCommand("pi-factory-docs", {
		description: "Show Pi Factory docs and command cheat sheet",
		handler: async (_args, ctx) => {
			pi.sendMessage({ customType: "pi-factory", content: docsText(ctx.cwd), display: true }, { triggerTurn: false });
		},
	});

	pi.registerCommand("pi-factory-next", {
		description: "Show Pi Factory next enhancement summary",
		handler: async (_args, ctx) => {
			pi.sendMessage({ customType: "pi-factory", content: nextText(), display: true }, { triggerTurn: false });
		},
	});

	pi.registerCommand("pi-next", {
		description: "Show the next best Pi Factory action",
		handler: async (_args, ctx) => {
			const next = nextActionText(ctx.cwd);
			pi.sendMessage({ customType: "pi-factory", content: `# Pi Factory Next\n\nRecommended command:\n\n\`${next}\``, display: true }, { triggerTurn: false });
		},
	});

	pi.registerCommand("pi-dashboard", {
		description: "Interactive Pi Factory dashboard",
		handler: async (_args, ctx) => {
			ensureFactory(ctx.cwd);
			const command = await ctx.ui.custom<string | undefined>((_tui, theme, _kb, done) => new PiFactoryDashboard(ctx.cwd, theme, done), {
				overlay: true,
				overlayOptions: { anchor: "right-center", width: "55%", minWidth: 60, maxHeight: "85%", margin: 1 },
			});
			if (command) pi.sendUserMessage(command, { deliverAs: ctx.isIdle() ? undefined : "followUp" } as any);
		},
	});

	pi.registerCommand("pi-factory-wizard", {
		description: "Guided Pi Factory setup wizard",
		handler: async (_args, ctx) => {
			const idea = await ctx.ui.input("Project goal", "What are you building or improving?");
			const isUi = await ctx.ui.confirm("UI/UX", "Will this touch user-facing UI or developer-facing onboarding?");
			ensureFactory(ctx.cwd, idea || "");
			if (isUi) {
				writeIfMissing(factoryPath(ctx.cwd, "DESIGN.md"), designScaffold(idea || "Project"));
			}
			const command = isUi ? `/pi-autoplan ${idea || "current project"}\n\nAlso create a UI/DX phase split and include DESIGN.md/UI-SPEC.md gates.` : `/pi-autoplan ${idea || "current project"}`;
			pi.sendUserMessage(command, { deliverAs: ctx.isIdle() ? undefined : "followUp" } as any);
		},
	});

	pi.registerCommand("pi-create-phase", {
		description: "Create a new .pi-factory phase scaffold",
		handler: async (args, ctx) => {
			const name = args.trim();
			if (!name) {
				ctx.ui.notify("Usage: /pi-create-phase <phase name>", "warning");
				return;
			}
			const phase = createPhase(ctx.cwd, name);
			ctx.ui.notify(`Created phase ${String(phase.id).padStart(2, "0")}: ${phase.name}`, "info");
			pi.sendMessage({ customType: "pi-factory", content: `Created phase scaffold: \`${path.relative(ctx.cwd, phase.dir)}\``, display: true }, { triggerTurn: false });
		},
	});

	pi.registerCommand("pi-design-system", {
		description: "Create or update .pi-factory/DESIGN.md design source of truth",
		handler: async (args, ctx) => {
			ensureFactory(ctx.cwd, args.trim());
			const designPath = factoryPath(ctx.cwd, "DESIGN.md");
			writeIfMissing(designPath, designScaffold(args.trim() || path.basename(ctx.cwd)));
			const prompt = `Use pi-gstack Design/DX and CEO/Product perspectives. Create or update ${path.relative(ctx.cwd, designPath)} as the product design source of truth.\n\nInput/context: ${args.trim() || "current project"}\n\nRead PROJECT.md, REQUIREMENTS.md, existing UI files, screenshots if available, and any existing DESIGN.md.\n\nOutput must cover: product personality, visual direction, typography, color, spacing/layout, components, copywriting, accessibility, and review gates. Ask concise questions only when required. Do not implement production code.`;
			await commandSendOrDraft(pi, ctx, prompt, "Design system");
		},
	});

	pi.registerCommand("pi-ui-phase", {
		description: "Create/update phase UI-SPEC.md design contract",
		handler: async (args, ctx) => {
			ensureFactory(ctx.cwd);
			const parsed = parseArgs(args);
			const phase = findPhase(ctx.cwd, parsed.positionals[0]);
			if (!phase) {
				ctx.ui.notify("Phase not found. Use /pi-create-phase first.", "warning");
				return;
			}
			const specPath = path.join(phase.dir, "UI-SPEC.md");
			writeIfMissing(specPath, uiSpecScaffold(phase, parsed.positionals.slice(1).join(" ")));
			const prompt = `Use pi-gstack Design/DX, QA/Security, and pi-superpowers planning discipline. Create/update the UI design contract for Phase ${phase.id} ${phase.name}.\n\nRead:\n- .pi-factory/DESIGN.md if present\n- .pi-factory/PROJECT.md\n- .pi-factory/REQUIREMENTS.md\n- ${path.relative(ctx.cwd, phase.contextPath)}\n- ${path.relative(ctx.cwd, phase.planPath)}\n- relevant UI files only\n\nWrite/update:\n- ${path.relative(ctx.cwd, specPath)}\n- ${path.relative(ctx.cwd, phase.planPath)} UI/UX contract section if needed\n\nUI-SPEC must include screens/routes/components, user flow, visual hierarchy, typography, color, spacing, states, responsive rules, accessibility, screenshot checkpoints, and acceptance criteria. Do not implement production code.`;
			await commandSendOrDraft(pi, ctx, prompt, "UI phase contract");
		},
	});

	pi.registerCommand("pi-sketch", {
		description: "Explore UI/design ideas with throwaway HTML variants",
		handler: async (args, ctx) => {
			ensureFactory(ctx.cwd, args.trim());
			const idea = args.trim() || "frontier design exploration";
			const sketchSlug = `${timestampForFile()}-${slugify(idea)}`;
			const sketchDir = factoryPath(ctx.cwd, SKETCHES_DIR, sketchSlug);
			ensureDir(sketchDir);
			writeIfMissing(factoryPath(ctx.cwd, SKETCHES_DIR, "MANIFEST.md"), `# Pi Factory Sketch Manifest\n\n`);
			const indexPath = path.join(sketchDir, "index.html");
			writeIfMissing(indexPath, `<!doctype html>\n<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pi Sketch: ${idea}</title><style>body{font-family:system-ui;margin:0;background:#0f172a;color:#e2e8f0}.wrap{max-width:1100px;margin:0 auto;padding:32px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}.card{background:#111827;border:1px solid #334155;border-radius:18px;padding:24px;min-height:280px}.tag{color:#93c5fd;font-size:12px;text-transform:uppercase;letter-spacing:.12em}button{background:#60a5fa;border:0;border-radius:10px;padding:10px 14px;font-weight:700}</style></head><body><main class="wrap"><h1>Pi Sketch: ${idea}</h1><p>Replace these cards with 2-3 real variants. Pick a winner, then record it in DECISION.md.</p><section class="grid"><article class="card"><div class="tag">Variant A</div><h2>Calm structured</h2><p>Clear hierarchy, restrained contrast, conventional layout.</p><button>Primary action</button></article><article class="card"><div class="tag">Variant B</div><h2>Bold editorial</h2><p>Higher contrast, stronger type scale, more personality.</p><button>Primary action</button></article><article class="card"><div class="tag">Variant C</div><h2>Dense power-user</h2><p>Information-rich layout optimized for speed and scanning.</p><button>Primary action</button></article></section></main></body></html>\n`);
			writeIfMissing(path.join(sketchDir, "DECISION.md"), `# Sketch Decision: ${idea}\n\nStatus: draft\nCreated: ${nowIso()}\n\n## Variants\n\n- A: TBD\n- B: TBD\n- C: TBD\n\n## Winner\n\nTBD\n\n## Design decisions to carry forward\n\n- TBD\n`);
			appendFile(factoryPath(ctx.cwd, SKETCHES_DIR, "MANIFEST.md"), `- ${nowIso()} — [${idea}](${sketchSlug}/index.html) — status: draft\n`);
			const prompt = `Use pi-gstack Design/DX. Improve the throwaway HTML sketch at ${path.relative(ctx.cwd, indexPath)} for this design idea:\n\n${idea}\n\nCreate 2-3 genuinely distinct variants in the same HTML file or sibling variant files. Use realistic copy/data. Make hover/focus states where useful. Update ${path.relative(ctx.cwd, path.join(sketchDir, "DECISION.md"))} with variant rationale and what user should choose. Do not touch production source files.`;
			await commandSendOrDraft(pi, ctx, prompt, "Design sketch");
		},
	});

	pi.registerCommand("pi-design-review", {
		description: "6-pillar UI audit with screenshots/code heuristics",
		handler: async (args, ctx) => {
			ensureFactory(ctx.cwd);
			const parsed = parseArgs(args);
			const phase = findPhase(ctx.cwd, parsed.positionals[0]);
			const url = flagString(parsed, "url") ?? (parsed.positionals.find((p) => /^https?:\/\//.test(p)) || undefined);
			await runDesignReview(pi, ctx, { phase, url, fix: hasFlag(parsed, "fix"), waive: hasFlag(parsed, "waive") });
		},
	});

	pi.registerCommand("pi-dx-review", {
		description: "Developer experience audit prompt",
		handler: async (args, ctx) => {
			ensureFactory(ctx.cwd);
			const prompt = `Use pi-gstack Design/DX and QA perspectives. Run a developer-experience audit for ${args.trim() || "this project"}.\n\nMeasure or infer: first-run setup, docs clarity, CLI/API ergonomics, error messages, onboarding time-to-hello-world, local dev environment, upgrade path. Use real commands where safe. Write .pi-factory/DX-REVIEW.md with scorecard, evidence, must-fix items, and quick wins. Do not make code changes unless explicitly asked.`;
			await commandSendOrDraft(pi, ctx, prompt, "DX review");
		},
	});

	pi.registerCommand("pi-ship-review", {
		description: "Final release readiness gate across product/eng/design/QA",
		handler: async (args, ctx) => {
			const prompt = `Use pi-gstack orchestrator. Run final ship review for ${args.trim() || "current project diff"}.\n\nReview: requirements coverage, roadmap phase status, git diff, verification evidence, UI/DX review reports, security/safety risks, docs/release notes. Output PASS/BLOCK with exact must-fix list and verification commands. Do not change files.`;
			await commandSendOrDraft(pi, ctx, prompt, "Ship review");
		},
	});

	pi.registerCommand("pi-plan-phase", {
		description: "Plan a phase into .pi-factory/phases/*/PLAN.md",
		handler: async (args, ctx) => {
			ensureFactory(ctx.cwd);
			const parsed = parseArgs(args);
			let phase = findPhase(ctx.cwd, parsed.positionals[0]);
			if (!phase && parsed.positionals.length > 0) phase = createPhase(ctx.cwd, parsed.positionals.join(" "));
			if (!phase) {
				ctx.ui.notify("No phase found. Use /pi-create-phase <name> first, or pass a new phase name.", "warning");
				return;
			}
			await commandSendOrDraft(pi, ctx, buildPlannerPrompt(phase, args), "Phase planning");
		},
	});

	pi.registerCommand("pi-execute-phase", {
		description: "Execute one phase via fresh child Pi session",
		handler: async (args, ctx) => {
			const parsed = parseArgs(args);
			const phaseArg = parsed.positionals[0];
			const verify = flagString(parsed, "verify") || undefined;
			const phase = findPhase(ctx.cwd, phaseArg);
			if (!phase) {
				ctx.ui.notify("Phase not found or no executable phase exists.", "warning");
				return;
			}
			const raw = `${phase.id}${verify ? ` --verify ${JSON.stringify(verify)}` : ""} --max-phases 1`;
			await runBuildLoop(pi, ctx, raw);
		},
	});

	const buildLoopHandler = async (args: string, ctx: ExtensionCommandContext) => {
		await runBuildLoop(pi, ctx, args);
	};

	pi.registerCommand("build-loop", {
		description: "Automated phase execution loop (fresh Pi child sessions, verification, retries, checkpoints)",
		handler: buildLoopHandler,
	});

	pi.registerCommand("pi-build-loop", {
		description: "Alias for /build-loop",
		handler: buildLoopHandler,
	});

	pi.registerCommand("pi-decide", {
		description: "GStack-style multi-role decision",
		handler: async (args, ctx) => {
			const question = args.trim();
			if (!question) {
				ctx.ui.notify("Usage: /pi-decide <question>", "warning");
				return;
			}
			await commandSendOrDraft(pi, ctx, buildDecidePrompt(question), "Decision");
		},
	});

	pi.registerCommand("pi-review", {
		description: "GStack-style plan/diff review",
		handler: async (args, ctx) => {
			await commandSendOrDraft(pi, ctx, buildReviewPrompt(args.trim()), "Review");
		},
	});

	const autoplanHandler = async (args: string, ctx: ExtensionCommandContext) => {
		ensureFactory(ctx.cwd, args.trim());
		const prompt = `Use pi-gstack, pi-gsd, and pi-superpowers. Run a Pi Factory autoplan for:\n\n${args.trim() || "the current project"}\n\nProcess:\n1. Office-hours style product interrogation: identify goal, user, constraints, non-goals.\n2. CEO/Product review for scope.\n3. Engineering review for architecture and sequencing.\n4. Design/DX and QA review.\n5. Write/update .pi-factory/PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md.\n6. Create small phase directories under .pi-factory/phases with CONTEXT.md and PLAN.md where enough information exists.\n\nDo not implement production code. End with next recommended command, usually /build-loop --dry-run.`;
		await commandSendOrDraft(pi, ctx, prompt, "Autoplan");
	};

	pi.registerCommand("pi-autoplan", {
		description: "End-to-end brainstorm/spec/review/phase planning prompt",
		handler: autoplanHandler,
	});

	pi.registerCommand("pi-factory-start", {
		description: "Alias for /pi-autoplan",
		handler: autoplanHandler,
	});

	pi.registerTool({
		name: "pi_factory_status",
		label: "Pi Factory Status",
		description: "Inspect .pi-factory phases and status.",
		parameters: Type.Object({}),
		async execute(_toolCallId, _params, _signal, _onUpdate, ctx): Promise<AgentToolResult> {
			return { content: [{ type: "text", text: statusText(ctx.cwd) }], details: { phases: discoverPhases(ctx.cwd) } };
		},
	});

	pi.registerTool({
		name: "pi_decision_record",
		label: "Pi Decision Record",
		description: "Save a GStack-style decision record under .pi-factory/decisions/.",
		parameters: Type.Object({
			title: Type.String({ description: "Decision title or question" }),
			content: Type.String({ description: "Markdown decision record" }),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx): Promise<AgentToolResult> {
			const file = writeMarkdownResult(ctx.cwd, params.title, params.content);
			return { content: [{ type: "text", text: `Saved decision: ${path.relative(ctx.cwd, file)}` }], details: { file } };
		},
	});

	pi.registerTool({
		name: "pi_build_loop",
		label: "Pi Build Loop",
		description: "Run Pi Factory build-loop automation from inside an agent turn. Prefer asking the user before long-running automation.",
		parameters: BuildLoopParams,
		async execute(_toolCallId, params, _signal, onUpdate, ctx: ExtensionContext): Promise<AgentToolResult> {
			const args: string[] = [];
			if (params.phase) args.push(params.phase);
			if (params.maxPhases !== undefined) args.push("--max-phases", String(params.maxPhases));
			if (params.verify) args.push("--verify", JSON.stringify(params.verify));
			if (params.dryRun) args.push("--dry-run");
			if (params.retries !== undefined) args.push("--retries", String(params.retries));
			if (params.requireCheck) args.push("--require-check");
			onUpdate?.({ content: [{ type: "text", text: `Queued /build-loop ${args.join(" ")}` }] });
			pi.sendUserMessage(`/build-loop ${args.join(" ")}`, { deliverAs: ctx.isIdle() ? undefined : "followUp" } as any);
			return { content: [{ type: "text", text: `Queued /build-loop ${args.join(" ")}` }], details: { args } };
		},
	});

	pi.on("session_start", async (_event, ctx) => {
		if (exists(factoryPath(ctx.cwd))) ctx.ui.setStatus("pi-factory", "🏭 ready");
	});
}
