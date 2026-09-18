/**
 * A use case is the only entry point into the application layer. One class, one
 * business transaction, so controllers stay thin and orchestration stays
 * testable without HTTP.
 */
export interface UseCase<TInput, TOutput> {
  execute(input: TInput): Promise<TOutput>
}

/** Use case that takes no input. */
export interface NoInputUseCase<TOutput> {
  execute(): Promise<TOutput>
}
