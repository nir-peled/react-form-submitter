import { it, expect, describe, beforeEach, vi, Mock } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useSubmitter } from "../useSubmitter";

describe("useSubmitter to fetch", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		globalThis.fetch = vi.fn();
		globalThis.confirm = vi.fn(() => true);
	});

	const mockOnSuccess = vi.fn();
	const mockOnError = vi.fn();
	const mockOnFailure = vi.fn();
	const mockMutate = vi.fn();

	it("should submit data successfully", async () => {
		(fetch as Mock).mockResolvedValueOnce({ ok: true });

		const { result } = renderHook(() =>
			useSubmitter("https://example.com", {
				onSuccess: mockOnSuccess,
				onError: mockOnError,
				onFailure: mockOnFailure,
			})
		);

		await act(() => result.current.submitter({ name: "Nir" }));

		expect(fetch).toHaveBeenCalledOnce();

		const [url, options] = (fetch as Mock).mock.calls[0];
		expect(url).toBe("https://example.com");
		expect(options.method).toBe("POST");
		expect(options.body).toBeInstanceOf(FormData);

		const formData = options.body as FormData;
		expect(formData.get("name")).toBe("Nir");

		expect(mockOnSuccess).toHaveBeenCalledWith({ name: "Nir" }, { ok: true });
		expect(mockOnError).not.toHaveBeenCalled();
		expect(mockOnFailure).not.toHaveBeenCalled();
		expect(result.current.isFailed).toBe(false);
	});

	it("should submit only changed data when defaultValues is set", async () => {
		(fetch as Mock).mockResolvedValueOnce({ ok: true });

		const { result } = renderHook(() =>
			useSubmitter("https://example.com", {
				defaultValues: { name: "Nir", age: 30 },
			})
		);

		await act(() => result.current.submitter({ name: "Nir", age: 31 }));

		const [, options] = (fetch as Mock).mock.calls[0];
		const formData = options.body as FormData;
		expect(formData.has("name")).toBe(false);
		expect(formData.get("age")).toBe("31");
	});

	it("should transform data before submit", async () => {
		(fetch as Mock).mockResolvedValueOnce({ ok: true });

		const transform = vi.fn((data) => ({ ...data, extra: "yes" }));
		const { result } = renderHook(() =>
			useSubmitter("https://example.com", {
				transform,
			})
		);

		await act(() => result.current.submitter({ name: "Nir" }));

		expect(transform).toHaveBeenCalledWith({ name: "Nir" });
		const [, options] = (fetch as Mock).mock.calls[0];
		const formData = options.body as FormData;

		expect(formData.get("name")).toBe("Nir");
		expect(formData.get("extra")).toBe("yes");
	});

	it("should not send if confirmation refused", async () => {
		(fetch as Mock).mockResolvedValueOnce({ ok: true });
		(confirm as Mock).mockReturnValueOnce(false);

		const { result } = renderHook(() =>
			useSubmitter("https://example.com", {
				confirmation: "Are you sure?",
			})
		);

		await act(() => result.current.submitter({ name: "Nir" }));

		expect(confirm).toHaveBeenCalledWith("Are you sure?");
		expect(fetch).not.toHaveBeenCalled();
	});

	it("should send if confirmation passes", async () => {
		(fetch as Mock).mockResolvedValueOnce({ ok: true });

		const { result } = renderHook(() =>
			useSubmitter("https://example.com", {
				confirmation: "Are you sure?",
			})
		);

		await act(() => result.current.submitter({ name: "Nir" }));

		expect(confirm).toHaveBeenCalledWith("Are you sure?");
		expect(fetch).toHaveBeenCalledOnce();
	});

	it("should call onError when fetch throws", async () => {
		(fetch as Mock).mockRejectedValueOnce(new Error("Network error"));

		const { result } = renderHook(() =>
			useSubmitter("https://example.com", {
				onError: mockOnError,
			})
		);

		await act(() => result.current.submitter({ name: "Nir" }));

		expect(mockOnError).toHaveBeenCalled();
		expect(result.current.isFailed).toBe(true);
	});

	it("should call mutate when provided", async () => {
		(fetch as Mock).mockResolvedValueOnce({ ok: true });
		const { result } = renderHook(() =>
			useSubmitter("https://example.com", {
				mutate: mockMutate,
			})
		);

		await act(() => result.current.submitter({ name: "Nir" }));

		expect(mockMutate).toHaveBeenCalledWith({ name: "Nir" });
	});

	it("should call onFailure when fetch returns not ok", async () => {
		(fetch as Mock).mockResolvedValueOnce({ ok: false, status: 400 });

		const { result } = renderHook(() =>
			useSubmitter("https://example.com", {
				onSuccess: mockOnSuccess,
				onFailure: mockOnFailure,
				onError: mockOnError,
				mutate: mockMutate,
			})
		);

		await act(() => result.current.submitter({ name: "Nir" }));

		expect(fetch).toHaveBeenCalled();
		expect(mockOnFailure).toHaveBeenCalledWith(
			{ name: "Nir" },
			{ ok: false, status: 400 }
		);
		expect(mockOnSuccess).not.toHaveBeenCalled();
		expect(mockOnError).not.toHaveBeenCalled();
		expect(mockMutate).not.toHaveBeenCalled();
		expect(result.current.isFailed).toBe(true);
	});
});

describe("useSubmitter to server action", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	const mockOnSuccess = vi.fn();
	const mockOnFailure = vi.fn();
	const mockOnError = vi.fn();
	const mockMutate = vi.fn();

	it("should call the server action instead of fetch", async () => {
		const serverAction = vi.fn().mockResolvedValueOnce(true);

		const { result } = renderHook(() =>
			useSubmitter(serverAction, {
				onSuccess: mockOnSuccess,
				onError: mockOnError,
				onFailure: mockOnFailure,
			})
		);

		await act(() => result.current.submitter({ name: "Nir" }));

		expect(serverAction).toHaveBeenCalledWith({ name: "Nir" });
		expect(fetch).not.toHaveBeenCalled();
		expect(mockOnSuccess).toHaveBeenCalledWith({ name: "Nir" }, undefined);
		expect(mockOnError).not.toHaveBeenCalled();
		expect(mockOnFailure).not.toHaveBeenCalled();
		expect(result.current.isFailed).toBe(false);
	});

	it("should handle server action returning false", async () => {
		const serverAction = vi.fn().mockResolvedValueOnce(false);

		const { result } = renderHook(() =>
			useSubmitter(serverAction, {
				onSuccess: mockOnSuccess,
				onError: mockOnError,
				onFailure: mockOnFailure,
				mutate: mockMutate,
			})
		);

		await act(() => result.current.submitter({ name: "Nir" }));

		expect(serverAction).toHaveBeenCalledWith({ name: "Nir" });
		expect(mockOnFailure).toHaveBeenCalledWith({ name: "Nir" }, undefined);
		expect(mockOnSuccess).not.toHaveBeenCalled();
		expect(mockOnError).not.toHaveBeenCalled();
		expect(mockMutate).not.toHaveBeenCalled();
		expect(result.current.isFailed).toBe(true);
	});

	it("should call transform & mutate when provided", async () => {
		const serverAction = vi.fn().mockResolvedValueOnce(true);
		const transform = vi.fn((data) => ({ ...data, foo: "bar" }));

		const { result } = renderHook(() =>
			useSubmitter(serverAction, {
				transform,
				mutate: mockMutate,
			})
		);

		await act(() => result.current.submitter({ name: "Nir" }));

		expect(transform).toHaveBeenCalledWith({ name: "Nir" });
		expect(serverAction).toHaveBeenCalledWith({ name: "Nir", foo: "bar" });
		expect(mockMutate).toHaveBeenCalledWith({ name: "Nir", foo: "bar" });
	});

	it("should not call mutate on server action failure", async () => {
		const serverAction = vi.fn().mockResolvedValueOnce(false);

		const { result } = renderHook(() =>
			useSubmitter(serverAction, {
				mutate: mockMutate,
			})
		);

		await act(() => result.current.submitter({ name: "Nir" }));

		expect(serverAction).toHaveBeenCalledWith({ name: "Nir" });
		expect(mockMutate).not.toHaveBeenCalled();
	});

	it("should not send if confirmation refused", async () => {
		const serverAction = vi.fn().mockResolvedValueOnce(false);
		(confirm as Mock).mockReturnValueOnce(false);

		const { result } = renderHook(() =>
			useSubmitter(serverAction, {
				confirmation: "Are you sure?",
			})
		);

		await act(() => result.current.submitter({ name: "Nir" }));

		expect(confirm).toHaveBeenCalledWith("Are you sure?");
		expect(serverAction).not.toHaveBeenCalled();
	});

	it("should send if confirmation passes", async () => {
		const serverAction = vi.fn().mockResolvedValueOnce(true);
		(confirm as Mock).mockReturnValueOnce(true);

		const { result } = renderHook(() =>
			useSubmitter(serverAction, {
				confirmation: "Are you sure?",
			})
		);

		await act(() => result.current.submitter({ name: "Nir" }));

		expect(confirm).toHaveBeenCalledWith("Are you sure?");
		expect(serverAction).toHaveBeenCalledOnce();
	});

	it("should call onError on server action error", async () => {
		const serverAction = vi.fn().mockRejectedValueOnce(new Error("Bad values"));

		const { result } = renderHook(() =>
			useSubmitter(serverAction, {
				onError: mockOnError,
			})
		);

		await act(() => result.current.submitter({ name: "Nir" }));

		expect(serverAction).toHaveBeenCalledOnce();
		expect(mockOnError).toHaveBeenCalledOnce();
	});
});
