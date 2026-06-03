import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export function StartBeforeDue(validationOptions?: ValidationOptions) {
  return function (target: object, propertyName: string) {
    registerDecorator({
      name: 'StartBeforeDue',
      target: target.constructor,
      propertyName,
      options: {
        message: '开始时间不能晚于截止时间',
        ...validationOptions,
      },
      validator: {
        validate(_value: unknown, args: ValidationArguments) {
          const obj = args.object as Record<string, unknown>;
          const start = obj.startDate;
          const due = obj.dueDate;
          if (!start || !due) return true; // skip if either is missing — individual @IsOptional handles null
          return new Date(start as string) <= new Date(due as string);
        },
      },
    });
  };
}
