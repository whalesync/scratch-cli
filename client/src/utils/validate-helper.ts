import { validate } from 'class-validator';

/**
 * Validates a DTO object using class-validator decorators.
 *
 * This helper function validates an object against its class-validator constraints
 * (e.g., @IsString(), @IsNotEmpty(), etc.) and throws a descriptive error if
 * validation fails. It's useful for validating data before sending it to the server.
 *
 * @param dto - The DTO object to validate. Must be an instance of a class decorated
 *              with class-validator decorators.
 *
 * @returns A promise that resolves to void if validation succeeds.
 *
 * @throws {Error} Throws an error with a formatted message containing all validation
 *                 failures if the DTO is invalid. The error message format is:
 *                 "Validation failed: property1: error1, error2; property2: error3"
 *
 * @example
 * ```typescript
 * import { IsString, IsNotEmpty } from 'class-validator';
 *
 * class CreateUserDto {
 *   @IsString()
 *   @IsNotEmpty()
 *   name?: string;
 * }
 *
 * const dto = new CreateUserDto();
 * dto.name = '';
 *
 * try {
 *   await validateHelper(dto);
 * } catch (error) {
 *   console.error(error.message);
 *   // Output: "Validation failed: name: name should not be empty"
 * }
 * ```
 */
export async function validateHelper(dto: object): Promise<void> {
  // Validate the DTO.
  const validationErrors = await validate(dto);
  if (validationErrors.length > 0) {
    const errorMessages = validationErrors
      .map((err) => `${err.property}: ${Object.values(err.constraints || {}).join(', ')}`)
      .join('; ');
    throw new Error(`Validation failed: ${errorMessages}`);
  }
}
