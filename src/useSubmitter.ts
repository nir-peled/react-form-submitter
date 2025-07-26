import type { BaseSyntheticEvent } from "react";
import { useState, useCallback } from "react";

interface UseSubmitterParams<
	T extends Record<string, unknown>,
	D extends Record<string, unknown> = T,
	FetchOptions extends RequestInit = RequestInit,
	TDefaults extends Partial<D> | undefined = undefined,
> {
	defaultValues?: TDefaults;
	method?: string;
	onSuccess?: (data: D, response?: Response) => void;
	onFailure?: (data: D, response?: Response) => void;
	onError?: (e: unknown) => void;
	transform?: (data: T) => D;
	fetchOptions?: FetchOptions;
	confirmation?: string;
	mutate?: (data: D) => void;
}

/**
 * Create a function that submits form data to an endpoint or a server action
 *
 * @param endpoint the endpoint to submit to
 * @param defaultValues the form's default values - submit only values not in here
 * @param method fetch HTTP method - default is POST
 * @param onSuccess callback on successful submit
 * @param onError callback on error thrown
 * @param transform function to transform the data before checks and submission
 * @param fetchOptions options for `fetch`
 * @param confirmation if included, use `confirm` with this message, and only move forward if confirmed
 * @param mutate data mutation hook
 * @returns the submitter function to use with handleSubmit
 */
export function useSubmitter<
	T extends Record<string, unknown>,
	D extends Record<string, unknown> = T,
	FetchOptions extends RequestInit = RequestInit,
	TDefaults extends Partial<D> | undefined = undefined,
>(
	destination:
		| string
		| ((
				data: TDefaults extends undefined ? D : Partial<D>,
		  ) => boolean | Promise<boolean>),
	{
		defaultValues,
		method = "POST",
		onSuccess,
		onFailure,
		onError,
		transform,
		fetchOptions,
		confirmation,
		mutate,
	}: UseSubmitterParams<T, D, FetchOptions, TDefaults>,
): {
	isFailed: boolean;
	submitter: (data: T, event?: BaseSyntheticEvent) => Promise<void>;
} {
	const [isFailed, setIsFailed] = useState<boolean>(false);

	const submitter = useCallback(
		async (data: T, event?: BaseSyntheticEvent) => {
			if (event) event.preventDefault();
			let transformedData = (transform ? transform(data) : data) as D;

			let submitOk = false;
			let response: Response | undefined;
			if (confirmation && !confirm(confirmation)) return;
			try {
				if (typeof destination == "string") {
					let formData = await to_form_data_without_default(
						transformedData,
						defaultValues,
					);
					response = await fetch(destination, {
						method,
						body: formData,
						...fetchOptions,
					});
					submitOk = response && response.ok;
				} else {
					submitOk = await destination(
						await without_defaults(transformedData, defaultValues),
					);
				}

				if (!submitOk && onFailure) onFailure(transformedData, response);
			} catch (e) {
				if (onError) onError(e);
			} finally {
				if (submitOk) {
					setIsFailed(false);
					if (onSuccess) onSuccess(transformedData, response);
					if (mutate) mutate(transformedData);
				} else {
					setIsFailed(true);
				}
			}
		},
		[
			isFailed,
			defaultValues,
			method,
			onSuccess,
			onError,
			transform,
			fetchOptions,
			confirmation,
			mutate,
		],
	);

	return { isFailed, submitter };
}

async function to_form_data_without_default<T extends Record<string, unknown>>(
	data: T,
	default_data?: Partial<T>,
): Promise<FormData> {
	let form_data = new FormData();
	for (let [key, value] of Object.entries(data)) {
		if (
			!default_data ||
			!(await is_same_values(value, default_data[key as keyof T]))
		) {
			const form_value =
				typeof value == "string" || value instanceof File
					? value
					: JSON.stringify(value);
			form_data.append(key, form_value);
		}
	}

	return form_data;
}

async function without_defaults<T extends Record<string, unknown>>(
	values: T,
	defaultValues?: Partial<T>,
): Promise<typeof defaultValues extends undefined ? T : Partial<T>> {
	if (!defaultValues) return values;

	let submit_values: Partial<T> = {};
	for (let [key, value] of Object.entries(values)) {
		if (!(await is_same_values(value, defaultValues[key as keyof T])))
			submit_values[key as keyof T] = value as T[keyof T];
	}

	return submit_values as any;
}

async function is_same_values<T, D>(
	value: T,
	default_value: D,
): Promise<boolean> {
	if (!default_value) return false;
	if (value instanceof File) {
		if (!(default_value instanceof File)) return false;
		return await is_same_files(value, default_value as File);
	}

	return value === default_value;
}

async function is_same_files(file: File, default_file: File): Promise<boolean> {
	return (
		file.name === default_file.name &&
		file.size === default_file.size &&
		file.type === default_file.type &&
		file.lastModified === default_file.lastModified
	);
}
