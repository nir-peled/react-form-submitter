# react-form-submitter

Submitter callback hook to use with React Hook Form

Expands the submission logic of React Hook Form to include:

- Submit either to an endpoint (with `fetch`) or to a server action, or any function
- Transform data before submission
- Submit only changed data - no need to send values to be ignored!
- Callbacks for onSuccess, onFailure, onError
- Possible to ask confirmation before submission
- Callback for mutate, in case the form's default values are dynamically fetched using something like TanStack Query

## Example

```tsx
import { useForm } from "react-hook-form";
import { useSubmitter } from "react-form-submitter";

interface FormData {
	name: string;
	age: number;
}

function MyForm({ defaultValues }: { defaultValues: FormData }) {
	const { register, handleSubmit } = useForm<FormData>({
		defaultValues,
	});
	const { isFailed, submitter } = useSubmitter<FormData>(myServerAction, {
		defaultValues,
		onSuccess() {
			console.log("Success!");
		},
	});

	return (
		<form onSubmit={handleSubmit(submitter)}>
			{isFailed && <p>Submission Failed</p>}
			<input {...register("name")} />
			<input {...register("age")} />
			<input type="submit" />
		</form>
	);
}
```

## Options:

`destination`: The first argument. Can be either a string - in which case it's used as a fetch endpoint - or a function.

If a string, submit sends the data as a form data in a fetch request, with the destination as the endpoint.

If a function, submit sends the data to the function.

`defaultValues`: If provided, values matching those are not submitted.

`method`: The fetch method. Defaults to "POST".

`onSuccess`: Callback, to be called when the submission is successfull. Called with the submitted data and the fetch response.

`onFailure`: Callback, to be called when the submission fails, but does not throw. Called with the submitted data and the fetch response.

`onError`: Callback, to be called when the submission throws. Called with the error.

`transform`: Function to transform the form's data before submission and before comparison to the default values.

`fetchOptions`: Options to provide to the fetch call.

`confirmation`: If provided, asks for confirmation using this string as a message before submitting.

`mutate`: Callback, to be called with the transformed data after a successful submission.
